import * as path from 'path';
import * as fs from 'fs';
import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Event, EventDocument } from './schemas/event.schema';
import { Guest, GuestDocument } from './schemas/guest.schema';
import { Wish, WishDocument } from './schemas/wish.schema';
import * as mongoose from 'mongoose';
import { MailerService } from 'src/sharedServices/mailer.service';
import Handlebars from 'handlebars';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';
import { UpdateInvitationDTO } from './dtos/updateInvitation.dto';
import { GuestDTO } from './dtos/guest.dto';
import { GiftDTO } from './dtos/gift.dto';
import { PublicRsvpDTO, RsvpDTO } from './dtos/rsvp.dto';
import { WishDTO } from './dtos/wish.dto';
import { MAX_WISHES_SHOWN } from './invitation.constants';

const templateStr = fs.readFileSync(path.resolve(process.cwd(), 'src/templates/sendInvitation.template.hbs')).toString('utf8')
const template = Handlebars.compile(templateStr);

// Fields of an event that guests may see (no host id, no counters).
const PUBLIC_EVENT_FIELDS = '_id title location mapLocation startAt type theme groomName brideName message allowPublicLink music scratchDate gifts';
// Fields the host can set, picked explicitly from request bodies.
const EDITABLE_FIELDS = [
  'title', 'location', 'mapLocation', 'startAt', 'type', 'theme',
  'groomName', 'brideName', 'message', 'allowPublicLink', 'music', 'scratchDate', 'gifts',
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
      .populate('guests', '_id name mail viewed source rsvp');

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

  /** A guest's personal invitation. Counts a view. */
  async findGuest(guestId: string) {
    assertObjectId(guestId);

    const invitation = await this.guestModel.findOneAndUpdate({
      isDeleted: { $ne: true },
      _id: guestId
    }, {
      $inc: { viewed: 1 }
    }).select('_id name event rsvp')
      .populate('event', PUBLIC_EVENT_FIELDS);

    if (!invitation || !(invitation as any).event) {
      throw new NotFoundException();
    }

    const eventId = (invitation as any).event._id;
    return {
      ...(invitation as any).toJSON(),
      wishes: await this.visibleWishes(eventId),
    };
  }

  /** The shared link anyone can open, if the host turned it on. */
  async findPublic(eventId: string) {
    assertObjectId(eventId);
    const event = await this.eventModel.findOneAndUpdate(
      { _id: eventId, isDeleted: { $ne: true }, allowPublicLink: true },
      { $inc: { publicViews: 1 } },
    ).setOptions({ timestamps: false })
      .select(PUBLIC_EVENT_FIELDS);
    if (!event) {
      throw new NotFoundException();
    }
    return { event, wishes: await this.visibleWishes(eventId) };
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

/** Headcount for the host: who answered what, and how many are coming. */
export function summarize(guests: Guest[]) {
  const summary = { invited: guests.length, opened: 0, attending: 0, maybe: 0, declined: 0, pending: 0, headcount: 0 };
  for (const guest of guests) {
    if (guest.viewed > 0) {
      summary.opened++;
    }
    const status = guest.rsvp?.status;
    if (status === 'attending' || status === 'maybe' || status === 'declined') {
      summary[status]++;
    } else {
      summary.pending++;
    }
    if (status === 'attending') {
      summary.headcount += guest.rsvp.count || 1;
    }
  }
  return summary;
}
