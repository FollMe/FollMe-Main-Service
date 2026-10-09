import * as path from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { Guest, GuestDocument } from './schemas/guest.schema';
import { Wish, WishDocument } from './schemas/wish.schema';
import * as mongoose from 'mongoose';
import { MailerService } from 'src/sharedServices/mailer.service';
import { CloudinaryService } from 'src/sharedServices/cloudinary.service';
import Handlebars from 'handlebars';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';
import { UpdateInvitationDTO } from './dtos/updateInvitation.dto';
import { GuestDTO } from './dtos/guest.dto';
import { UpdateGuestDTO } from './dtos/updateGuest.dto';
import { GiftDTO } from './dtos/gift.dto';
import { PublicRsvpDTO, RsvpDTO } from './dtos/rsvp.dto';
import { WishDTO } from './dtos/wish.dto';
import { ArrivalDTO, WalkInDTO } from './dtos/desk.dto';
import { GiftGiverDTO, ReceivedGiftDTO } from './dtos/receivedGift.dto';
import { SeatDTO } from './dtos/seating.dto';
import { MAX_PHOTOS, MAX_WISHES_SHOWN } from './invitation.constants';

const templateStr = fs.readFileSync(path.resolve(process.cwd(), 'src/templates/sendInvitation.template.hbs')).toString('utf8')
const template = Handlebars.compile(templateStr);

// Fields of an event that guests may see (no host id, no counters).
const PUBLIC_EVENT_FIELDS = '_id title location mapLocation startAt rsvpBy type theme groomName brideName message allowPublicLink music scratchDate gifts photos';
// Fields of a guest the host sees.
const HOST_GUEST_FIELDS = '_id name mail viewed source rsvp sentAt remindedAt thankedAt group table arrivedAt arrivedCount gift';
// Fields of a guest the reception desk sees: who is expected, who came.
const DESK_GUEST_FIELDS = '_id name group table source rsvp.status rsvp.count arrivedAt arrivedCount';
// Fields the host can set, picked explicitly from request bodies.
const EDITABLE_FIELDS = [
  'title', 'location', 'mapLocation', 'startAt', 'type', 'theme',
  'groomName', 'brideName', 'message', 'allowPublicLink', 'music', 'scratchDate', 'gifts', 'seatsPerTable', 'rsvpBy',
] as const;

function pickEditable(body: CreateInvitationDTO | UpdateInvitationDTO) {
  const out: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    const value = body[key];
    if (key === 'gifts') {
      if (Array.isArray(value)) {
        out.gifts = (value as GiftDTO[]).map(pickGift);
      }
    } else if (value !== undefined) {
      out[key] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return out;
}

/** Only the known fields of a gift account, account name as banks print it. */
function pickGift(gift: GiftDTO) {
  return {
    side: gift.side,
    bankBin: gift.bankBin,
    accountNumber: gift.accountNumber.trim(),
    accountName: (gift.accountName ?? '').trim().toUpperCase(),
  };
}

/** A group or table name with single spaces, or undefined for none. */
function cleanGroup(group?: string) {
  const clean = group?.replace(/\s+/g, ' ').trim();
  return clean || undefined;
}

const cleanTable = cleanGroup;

/** A ledger line as stored, or undefined when there is nothing in it. */
function cleanGift(gift?: ReceivedGiftDTO | null) {
  const note = gift?.note?.replace(/\s+/g, ' ').trim();
  const amount = gift?.amount || undefined;
  if (!amount && !note) {
    return undefined;
  }
  return { amount, note: note || undefined, at: new Date() };
}

function assertObjectId(id: string) {
  if (!mongoose.isValidObjectId(id)) {
    throw new HttpException("Không tìm thấy tài nguyên!", HttpStatus.BAD_REQUEST);
  }
}

@Injectable()
export class InvitationsService {
  private readonly limit = 5;
  constructor(
    @InjectModel(Event.name)
    private readonly eventModel: mongoose.Model<EventDocument>,
    @InjectModel(Guest.name)
    private readonly guestModel: mongoose.Model<GuestDocument>,
    @InjectModel(Wish.name)
    private readonly wishModel: mongoose.Model<WishDocument>,
    @InjectConnection()
    private readonly connection: mongoose.Connection,
    private readonly mailerService: MailerService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  async getList(userId: string, page: number = 1) {
    const offset = page > 1 ? (page - 1) * this.limit : 0;

    return await this.eventModel.find({ isDeleted: { $ne: true }, host: userId })
      .select('-isDeleted -host')
      .sort({ startAt: -1, _id: 1 })
      .populate('numGuests')
      .limit(this.limit)
      .skip(offset);
  }

  /** The host's view: guests with their answers, all wishes and a summary. */
  async findOne(eventId: string, userId: string) {
    assertObjectId(eventId);

    const invitation = await this.eventModel.findOne({ isDeleted: { $ne: true }, host: userId, _id: eventId })
      .select('-isDeleted -host')
      .populate('guests', HOST_GUEST_FIELDS);

    if (!invitation) {
      throw new NotFoundException();
    }

    const wishes = await this.wishModel.find({ event: eventId })
      .sort({ createdAt: -1 })
      .select('_id name message isHidden createdAt');

    const guests = ((invitation as any).guests ?? []) as Guest[];
    return {
      ...(invitation as any).toJSON(),
      wishes,
      summary: summarize(guests),
    };
  }

  /**
   * A guest's personal invitation. Counts a view, unless it is the host
   * (`viewerId`) looking at their guest's card.
   */
  async findGuest(guestId: string, viewerId?: string) {
    assertObjectId(guestId);

    // Their table too: the card shows it on the day
    const guest: any = await this.guestModel.findOne({ isDeleted: { $ne: true }, _id: guestId })
      .select('_id name event rsvp table')
      .populate('event', `${PUBLIC_EVENT_FIELDS} host isDeleted`);
    const event = guest?.event;
    if (!guest || !event || event.isDeleted) {
      throw new NotFoundException();
    }

    if (!viewerId || String(event.host) !== String(viewerId)) {
      await this.guestModel.updateOne({ _id: guest._id }, { $inc: { viewed: 1 } });
    }

    // Guests never see who the host is
    const { host, isDeleted, ...publicEvent } = event.toJSON();
    return {
      ...guest.toJSON(),
      event: publicEvent,
      wishes: await this.visibleWishes(event._id),
    };
  }

  /**
   * The shared link anyone can open, if the host turned it on. Counts a
   * view, unless it is the host (`viewerId`) checking their own card.
   */
  async findPublic(eventId: string, viewerId?: string) {
    assertObjectId(eventId);
    const event: any = await this.eventModel.findOne({ _id: eventId, isDeleted: { $ne: true }, allowPublicLink: true })
      .select(`${PUBLIC_EVENT_FIELDS} host`);
    if (!event) {
      throw new NotFoundException();
    }
    if (!viewerId || String(event.host) !== String(viewerId)) {
      await this.eventModel.updateOne({ _id: eventId }, { $inc: { publicViews: 1 } }, { timestamps: false });
    }
    const { host, ...publicEvent } = event.toJSON();
    return { event: publicEvent, wishes: await this.visibleWishes(eventId) };
  }

  /**
   * Title and description for link previews (Zalo, Facebook...). Read-only:
   * crawlers must not count as views.
   */
  async preview(kind: 'guest' | 'event', id: string) {
    assertObjectId(id);
    let event: any;
    let guestName = '';
    if (kind === 'guest') {
      const guest: any = await this.guestModel.findOne({ _id: id, isDeleted: { $ne: true } })
        .select('name event')
        .populate('event', PUBLIC_EVENT_FIELDS + ' isDeleted');
      event = guest?.event;
      guestName = guest?.name ?? '';
    } else {
      event = await this.eventModel.findOne({ _id: id, isDeleted: { $ne: true }, allowPublicLink: true })
        .select(PUBLIC_EVENT_FIELDS);
    }
    if (!event || event.isDeleted) {
      throw new NotFoundException();
    }
    const couple = ['wedding', 'engagement'].includes(event.type) && event.groomName && event.brideName;
    const headline = couple ? `${event.groomName} & ${event.brideName}` : event.title;
    const when = event.startAt ? formatViDate(new Date(event.startAt)) : '';
    return {
      title: couple ? `Thiệp ${event.type === 'wedding' ? 'cưới' : 'ăn hỏi'} ${headline}` : `Thiệp mời: ${headline}`,
      description: [guestName && `Trân trọng kính mời ${guestName}.`, when, event.location].filter(Boolean).join(' · '),
      type: event.type,
      image: ogImage(event.photos?.[0]?.url),
    };
  }

  private visibleWishes(eventId: string) {
    return this.wishModel.find({ event: eventId, isHidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(MAX_WISHES_SHOWN)
      .select('_id name message createdAt');
  }

  async createOne(invitation: CreateInvitationDTO, userId: string, slEmail: string) {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const event = await new this.eventModel({
        ...pickEditable(invitation),
        host: userId
      }).save({ session })

      const guestList = await this.insertGuests(event._id, invitation.guests ?? [], session);
      await session.commitTransaction();
      this.mailGuests(guestList, slEmail);

      return {
        _id: event._id,
      }
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  /**
   * Deletes an event: its personal links, public link, venue screen and
   * reception desk stop working, the photos are removed from Cloudinary. The event, guests,
   * answers and wishes are kept PURGE_AFTER_SECONDS (to undo a mistake on
   * request), then MongoDB removes them (TTL on deletedAt).
   */
  async remove(eventId: string, userId: string) {
    assertObjectId(eventId);
    const deletedAt = new Date();
    // The event as it was, to find its photos
    const event: any = await this.eventModel.findOneAndUpdate(
      { _id: eventId, host: userId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt }, $unset: { photos: 1, screenKey: 1, deskKey: 1 } },
    ).select('_id photos');
    if (!event) {
      throw new NotFoundException();
    }
    await Promise.all([
      this.guestModel.updateMany({ event: eventId, deletedAt: { $exists: false } }, { $set: { deletedAt } }),
      this.wishModel.updateMany({ event: eventId }, { $set: { deletedAt } }),
    ]);
    for (const photo of event.photos ?? []) {
      this.destroyPhoto(photo.publicId);
    }
    return { _id: eventId };
  }

  async update(eventId: string, userId: string, body: UpdateInvitationDTO, slEmail: string) {
    assertObjectId(eventId);
    const event = await this.eventModel.findOneAndUpdate(
      { _id: eventId, host: userId, isDeleted: { $ne: true } },
      { $set: pickEditable(body) },
      { new: true },
    );
    if (!event) {
      throw new NotFoundException();
    }
    if (body.addGuests?.length) {
      const guestList = await this.insertGuests(event._id, body.addGuests);
      this.mailGuests(guestList, slEmail);
    }
    return { _id: event._id };
  }

  private async insertGuests(eventId: unknown, guests: GuestDTO[], session?: mongoose.ClientSession) {
    if (guests.length === 0) {
      return [];
    }
    return await this.guestModel.insertMany(guests.map(guest => ({
      event: eventId,
      name: guest.name,
      mail: guest.email,
      group: cleanGroup(guest.group),
      source: 'host',
    })), { session });
  }

  private mailGuests(guestList: any[], slEmail: string) {
    guestList.forEach(guest => {
      if (guest.mail) {
        this.mailerService.sendInBackground({
          from: '"FollMe " <follme.noreply@gmail.com>',
          to: guest.mail,
          subject: '[FollMe.eCard] Thư mời sự kiện',
          html: template({
            sender: slEmail,
            invitationUrl: `${process.env.FE_URL}/invitations/${guest._id}`
          })
        })
      }
    })
  }

  private async liveEvent(eventId: unknown, opts: { publicOnly?: boolean } = {}) {
    const filter: Record<string, unknown> = { _id: eventId, isDeleted: { $ne: true } };
    if (opts.publicOnly) {
      filter.allowPublicLink = true;
    }
    const event = await this.eventModel.findOne(filter).select('_id startAt');
    if (!event) {
      throw new NotFoundException();
    }
    return event;
  }

  private assertNotOver(event: { startAt?: Date }) {
    if (event.startAt && new Date(event.startAt).getTime() < Date.now()) {
      throw new BadRequestException('Sự kiện đã diễn ra, không thể phản hồi nữa');
    }
  }

  /** A guest answers on their personal link. Answering again replaces it. */
  async rsvpGuest(guestId: string, body: RsvpDTO) {
    assertObjectId(guestId);
    const guest = await this.guestModel.findOne({ _id: guestId, isDeleted: { $ne: true } }).select('_id event');
    if (!guest) {
      throw new NotFoundException();
    }
    this.assertNotOver(await this.liveEvent((guest as any).event));

    const rsvp = toRsvp(body);
    await this.guestModel.updateOne({ _id: guestId }, { $set: { rsvp } });
    return { guestId, rsvp };
  }

  /**
   * Someone answers on the public link. They become a guest; the returned
   * guestId lets their browser update the answer later via rsvpGuest.
   */
  async rsvpPublic(eventId: string, body: PublicRsvpDTO) {
    assertObjectId(eventId);
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Vui lòng nhập tên của bạn');
    }
    this.assertNotOver(await this.liveEvent(eventId, { publicOnly: true }));
    const rsvp = toRsvp(body);
    const guest = await this.guestModel.create({
      event: eventId,
      name,
      source: 'public',
      rsvp,
    });
    return { guestId: guest._id, rsvp };
  }

  async wishFromGuest(guestId: string, body: WishDTO) {
    assertObjectId(guestId);
    const guest = await this.guestModel.findOne({ _id: guestId, isDeleted: { $ne: true } }).select('_id name event');
    if (!guest) {
      throw new NotFoundException();
    }
    await this.liveEvent((guest as any).event);
    return this.saveWish((guest as any).event, guest.name, body.message, (guest as any)._id);
  }

  async wishFromPublic(eventId: string, body: WishDTO) {
    assertObjectId(eventId);
    const name = body.name?.trim();
    if (!name) {
      throw new BadRequestException('Vui lòng nhập tên của bạn');
    }
    await this.liveEvent(eventId, { publicOnly: true });
    return this.saveWish(eventId, name, body.message);
  }

  private async saveWish(eventId: unknown, name: string, message: string, guestId?: unknown) {
    const text = message.trim();
    if (!text) {
      throw new BadRequestException('Vui lòng nhập lời chúc');
    }
    const wish = await this.wishModel.create({ event: eventId, guest: guestId, name, message: text });
    return { _id: wish._id, name: wish.name, message: wish.message, createdAt: (wish as any).createdAt };
  }

  // ---------- Guests ----------

  /** Renames or regroups a guest (their link shows the new name), marks it sent, reminded or thanked. */
  async updateGuest(eventId: string, guestId: string, userId: string, body: UpdateGuestDTO) {
    assertObjectId(guestId);
    await this.hostEvent(eventId, userId, '_id');
    const set: Record<string, unknown> = {};
    const unset: Record<string, 1> = {};
    if (body.name !== undefined) {
      const name = body.name.replace(/\s+/g, ' ').trim();
      if (!name) {
        throw new BadRequestException('Vui lòng nhập tên khách');
      }
      set.name = name;
    }
    if (body.group !== undefined) {
      const group = cleanGroup(body.group);
      if (group) {
        set.group = group;
      } else {
        unset.group = 1;
      }
    }
    if (body.table !== undefined) {
      const table = cleanTable(body.table);
      if (table) {
        set.table = table;
      } else {
        unset.table = 1;
      }
    }
    if (body.sent === true) {
      set.sentAt = new Date();
    } else if (body.sent === false) {
      unset.sentAt = 1;
    }
    if (body.reminded === true) {
      set.remindedAt = new Date();
    } else if (body.reminded === false) {
      unset.remindedAt = 1;
    }
    if (body.thanked === true) {
      set.thankedAt = new Date();
    } else if (body.thanked === false) {
      unset.thankedAt = 1;
    }
    if (body.gift !== undefined) {
      const gift = cleanGift(body.gift);
      if (gift) {
        set.gift = gift;
      } else {
        unset.gift = 1;
      }
    }
    if (!Object.keys(set).length && !Object.keys(unset).length) {
      throw new BadRequestException('Không có gì để cập nhật');
    }
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) {
      update.$set = set;
    }
    if (Object.keys(unset).length) {
      update.$unset = unset;
    }
    const guest = await this.guestModel.findOneAndUpdate(
      { _id: guestId, event: eventId, isDeleted: { $ne: true } },
      update,
      { new: true },
    ).select(HOST_GUEST_FIELDS);
    if (!guest) {
      throw new NotFoundException();
    }
    return guest;
  }

  /** Writes the gift of someone who is not on the list: they join it, without a link to send. */
  async addGiftGiver(eventId: string, userId: string, body: GiftGiverDTO) {
    await this.hostEvent(eventId, userId, '_id');
    const name = body.name.replace(/\s+/g, ' ').trim();
    if (!name) {
      throw new BadRequestException('Vui lòng nhập tên người mừng');
    }
    const gift = cleanGift(body.gift);
    if (!gift) {
      throw new BadRequestException('Vui lòng nhập số tiền hoặc ghi chú');
    }
    const guest: any = await this.guestModel.create({ event: eventId, name, group: cleanGroup(body.group), source: 'ledger', gift });
    const { _id, group, source, viewed } = guest;
    return { _id, name, group, source, viewed, gift };
  }

  /**
   * Seats many guests at once (the automatic plan, or clearing it). Guests
   * of another event or deleted ones are left out of the count.
   */
  async seatGuests(eventId: string, userId: string, seats: SeatDTO[]) {
    await this.hostEvent(eventId, userId, '_id');
    if (!seats.length) {
      return { updated: 0 };
    }
    const res = await this.guestModel.bulkWrite(seats.map(seat => {
      const table = cleanTable(seat.table);
      return {
        updateOne: {
          filter: { _id: seat.guest, event: eventId, isDeleted: { $ne: true } },
          update: table ? { $set: { table } } : { $unset: { table: 1 } },
        },
      };
    }) as any);
    return { updated: res.matchedCount };
  }

  /** Removes a guest: their personal link stops working (purged later). */
  async removeGuest(eventId: string, guestId: string, userId: string) {
    assertObjectId(guestId);
    await this.hostEvent(eventId, userId, '_id');
    const res = await this.guestModel.updateOne(
      { _id: guestId, event: eventId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
    if (!res.matchedCount) {
      throw new NotFoundException();
    }
    return { _id: guestId };
  }

  // ---------- Photos ----------

  private async hostEvent(eventId: string, userId: string, fields: string) {
    assertObjectId(eventId);
    const event = await this.eventModel.findOne({ _id: eventId, host: userId, isDeleted: { $ne: true } }).select(fields);
    if (!event) {
      throw new NotFoundException();
    }
    return event as any;
  }

  /** Uploads a photo to the end of the album (the first one is the cover). */
  async addPhoto(eventId: string, userId: string, file: Express.Multer.File) {
    const event = await this.hostEvent(eventId, userId, '_id photos');
    if ((event.photos?.length ?? 0) >= MAX_PHOTOS) {
      throw new BadRequestException(`Mỗi thiệp có tối đa ${MAX_PHOTOS} ảnh`);
    }
    const uploaded: any = await this.cloudinaryService.uploadImage(file, `FollMe/events/${eventId}`);
    const photo = {
      _id: new mongoose.Types.ObjectId(),
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      width: uploaded.width,
      height: uploaded.height,
    };
    // Re-checks the limit: another upload may have finished meanwhile.
    const res = await this.eventModel.updateOne(
      { _id: eventId, host: userId, isDeleted: { $ne: true }, [`photos.${MAX_PHOTOS - 1}`]: { $exists: false } },
      { $push: { photos: photo } },
    );
    if (!res.modifiedCount) {
      this.destroyPhoto(photo.publicId);
      throw new BadRequestException(`Mỗi thiệp có tối đa ${MAX_PHOTOS} ảnh`);
    }
    return photo;
  }

  async removePhoto(eventId: string, photoId: string, userId: string) {
    assertObjectId(eventId);
    assertObjectId(photoId);
    // Returns the event as it was, so the removed photo can be found.
    const event: any = await this.eventModel.findOneAndUpdate(
      { _id: eventId, host: userId, isDeleted: { $ne: true }, 'photos._id': photoId },
      { $pull: { photos: { _id: photoId } } },
    ).select('photos');
    const photo = event?.photos?.find(p => String(p._id) === photoId);
    if (!photo) {
      throw new NotFoundException();
    }
    this.destroyPhoto(photo.publicId);
    return { _id: photoId };
  }

  /** Puts the album in the given order; `order` lists every photo id once. */
  async orderPhotos(eventId: string, userId: string, order: string[]) {
    const event = await this.hostEvent(eventId, userId, '_id photos');
    const photos: any[] = event.photos ?? [];
    const byId = new Map(photos.map(p => [String(p._id), p]));
    const sameSet = order.length === photos.length
      && new Set(order).size === order.length
      && order.every(id => byId.has(id));
    if (!sameSet) {
      throw new BadRequestException('Album vừa thay đổi, vui lòng tải lại trang rồi thử lại');
    }
    // Only if no photo was added or removed since it was read.
    const res = await this.eventModel.updateOne(
      { _id: eventId, host: userId, isDeleted: { $ne: true }, photos: { $size: photos.length } },
      { $set: { photos: order.map(id => byId.get(id)) } },
    );
    if (!res.matchedCount) {
      throw new BadRequestException('Album vừa thay đổi, vui lòng tải lại trang rồi thử lại');
    }
    return { order };
  }

  private destroyPhoto(publicId: string) {
    this.cloudinaryService.destroy(publicId).catch(err => {
      console.error(`Could not delete photo ${publicId} from Cloudinary`, err);
    });
  }

  // ---------- Venue screen ----------

  /**
   * The secret key of a link the host hands to a helper (venue screen,
   * reception desk), made on first use. `rotate` makes a new one, so the
   * old link stops working.
   */
  private async secretKey(field: 'screenKey' | 'deskKey', eventId: string, userId: string, rotate: boolean) {
    const event = await this.hostEvent(eventId, userId, `_id +${field}`);
    const filter = { _id: eventId, host: userId, isDeleted: { $ne: true } };
    if (event[field] && !rotate) {
      return { key: event[field] as string };
    }
    const key = randomBytes(16).toString('hex');
    if (rotate) {
      await this.eventModel.updateOne(filter, { $set: { [field]: key } });
      return { key };
    }
    // Two first requests at once must agree on one key.
    await this.eventModel.updateOne({ ...filter, [field]: { $exists: false } }, { $set: { [field]: key } });
    const saved: any = await this.eventModel.findOne(filter).select(`+${field}`);
    return { key: (saved?.[field] ?? key) as string };
  }

  /** The venue screen's secret key; `rotate` replaces it. */
  screenKey(eventId: string, userId: string, rotate = false) {
    return this.secretKey('screenKey', eventId, userId, rotate);
  }

  /** The reception desk's secret key; `rotate` replaces it. */
  deskKey(eventId: string, userId: string, rotate = false) {
    return this.secretKey('deskKey', eventId, userId, rotate);
  }

  /**
   * What the venue screen shows. Without `since`: the event and the latest
   * wishes. With it: wishes added, hidden or shown again since then, to poll.
   * `cursor` is the `since` of the next poll.
   */
  async screen(eventId: string, key: string, since?: string) {
    assertObjectId(eventId);
    assertKey(key);
    let sinceDate: Date | undefined;
    if (since) {
      sinceDate = new Date(since);
      if (Number.isNaN(sinceDate.getTime())) {
        throw new BadRequestException('since không hợp lệ');
      }
    }
    // A wish saved just before the query may be committed just after it;
    // overlapping polls catch it, and the screen drops repeats by id.
    const cursor = new Date(Date.now() - SCREEN_POLL_OVERLAP_MS).toISOString();
    if (!sinceDate) {
      const event = await this.eventModel.findOne({ _id: eventId, isDeleted: { $ne: true }, screenKey: key })
        .select(PUBLIC_EVENT_FIELDS);
      if (!event) {
        throw new NotFoundException();
      }
      return { event, wishes: await this.visibleWishes(eventId), cursor };
    }
    const event = await this.eventModel.findOne({ _id: eventId, isDeleted: { $ne: true }, screenKey: key }).select('_id');
    if (!event) {
      throw new NotFoundException();
    }
    const wishes = await this.wishModel.find({ event: eventId, updatedAt: { $gte: sinceDate } })
      .sort({ updatedAt: 1 })
      .limit(MAX_WISHES_SHOWN)
      .select('_id name message isHidden createdAt');
    return { wishes, cursor };
  }

  // ---------- Reception desk ----------

  private async deskEvent(eventId: string, key: string, fields: string) {
    assertObjectId(eventId);
    assertKey(key);
    const event = await this.eventModel.findOne({ _id: eventId, isDeleted: { $ne: true }, deskKey: key }).select(fields);
    if (!event) {
      throw new NotFoundException();
    }
    return event;
  }

  /** What the reception desk shows: the event, and every guest with their answer and check-in. */
  async desk(eventId: string, key: string) {
    const event = await this.deskEvent(eventId, key, '_id title type groomName brideName startAt location seatsPerTable');
    const guests = await this.guestModel.find({ event: eventId, isDeleted: { $ne: true } })
      .sort({ _id: 1 })
      .select(DESK_GUEST_FIELDS);
    return { event, guests };
  }

  /**
   * Checks a guest in with how many people came, or undoes it. Checking in
   * again only changes the count: the arrival time stays the first one.
   */
  async setArrival(eventId: string, key: string, guestId: string, body: ArrivalDTO) {
    assertObjectId(guestId);
    await this.deskEvent(eventId, key, '_id');
    const seat = body.table === undefined ? {} : { table: cleanTable(body.table) ?? '$$REMOVE' };
    const update = body.arrived
      ? [{
        $set: {
          arrivedAt: { $ifNull: ['$arrivedAt', new Date()] },
          arrivedCount: body.count ?? { $ifNull: ['$arrivedCount', 1] },
          ...seat,
        },
      }]
      : { $unset: { arrivedAt: 1, arrivedCount: 1 } };
    const guest = await this.guestModel.findOneAndUpdate(
      { _id: guestId, event: eventId, isDeleted: { $ne: true } },
      update as any,
      { new: true },
    ).select(DESK_GUEST_FIELDS);
    if (!guest) {
      throw new NotFoundException();
    }
    return guest;
  }

  /** Someone not on the list came: added as a guest, already checked in. */
  async addWalkIn(eventId: string, key: string, body: WalkInDTO) {
    await this.deskEvent(eventId, key, '_id');
    const name = body.name.replace(/\s+/g, ' ').trim();
    if (!name) {
      throw new BadRequestException('Vui lòng nhập tên khách');
    }
    const guest: any = await this.guestModel.create({
      event: eventId,
      name,
      group: cleanGroup(body.group),
      source: 'desk',
      table: cleanTable(body.table),
      arrivedAt: new Date(),
      arrivedCount: body.count ?? 1,
    });
    const { _id, group, table, source, arrivedAt, arrivedCount } = guest;
    return { _id, name, group, table, source, arrivedAt, arrivedCount };
  }

  /** Takes back a walk-in added by mistake. Guests from the host's list are only un-checked. */
  async removeWalkIn(eventId: string, key: string, guestId: string) {
    assertObjectId(guestId);
    await this.deskEvent(eventId, key, '_id');
    const res = await this.guestModel.updateOne(
      { _id: guestId, event: eventId, source: 'desk', isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );
    if (!res.matchedCount) {
      throw new NotFoundException();
    }
    return { _id: guestId };
  }

  async setWishHidden(eventId: string, wishId: string, userId: string, isHidden: boolean) {
    assertObjectId(eventId);
    assertObjectId(wishId);
    const event = await this.eventModel.findOne({ _id: eventId, host: userId, isDeleted: { $ne: true } }).select('_id');
    if (!event) {
      throw new NotFoundException();
    }
    const res = await this.wishModel.updateOne({ _id: wishId, event: eventId }, { $set: { isHidden } });
    if (!res.matchedCount) {
      throw new NotFoundException();
    }
    return { _id: wishId, isHidden };
  }
}

const SCREEN_POLL_OVERLAP_MS = 5000;

/** Keys of helper links are 32 hex characters; anything else is unknown. */
function assertKey(key?: string) {
  if (!/^[a-f0-9]{32}$/.test(key ?? '')) {
    throw new NotFoundException();
  }
}

/**
 * A Cloudinary photo cropped to the 1200x630 link preview size, keeping
 * faces in frame. Undefined for anything that is not a Cloudinary upload.
 */
export function ogImage(url?: string) {
  if (!url || !url.includes('/image/upload/')) {
    return undefined;
  }
  return url.replace('/image/upload/', '/image/upload/c_fill,g_faces,w_1200,h_630,q_auto,f_jpg/');
}

/** "11:00 thứ Bảy, 6/2/2027" in Vietnam time. */
export function formatViDate(date: Date) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const days = ['Chủ Nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
  const hh = String(vn.getUTCHours()).padStart(2, '0');
  const mm = String(vn.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} ${days[vn.getUTCDay()]}, ${vn.getUTCDate()}/${vn.getUTCMonth() + 1}/${vn.getUTCFullYear()}`;
}

function toRsvp(body: RsvpDTO) {
  return {
    status: body.status,
    // Someone not coming brings nobody.
    count: body.status === 'declined' ? 0 : (body.count ?? 1),
    note: body.note?.trim() ?? '',
    respondedAt: new Date(),
  };
}

/** Headcount for the host: who answered what, how many are coming, how many came. */
export function summarize(guests: Guest[]) {
  const summary = {
    invited: guests.length, sent: 0, opened: 0, attending: 0, maybe: 0, declined: 0, pending: 0, headcount: 0,
    arrived: 0, arrivedPeople: 0, gifts: 0, giftTotal: 0,
  };
  for (const guest of guests) {
    if (guest.sentAt) {
      summary.sent++;
    }
    if (guest.viewed > 0) {
      summary.opened++;
    }
    const status = guest.rsvp?.status;
    if (status === 'attending' || status === 'maybe' || status === 'declined') {
      summary[status]++;
    } else if (!guest.source || guest.source === 'host') {
      // Walk-ins and gift givers added later were never asked
      summary.pending++;
    }
    if (status === 'attending') {
      summary.headcount += guest.rsvp.count || 1;
    }
    if (guest.arrivedAt) {
      summary.arrived++;
      summary.arrivedPeople += guest.arrivedCount || 1;
    }
    if (guest.gift) {
      summary.gifts++;
      summary.giftTotal += guest.gift.amount || 0;
    }
  }
  return summary;
}
