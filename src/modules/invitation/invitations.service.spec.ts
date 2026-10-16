import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InvitationsService, foldName, ogImage, owned, summarize, tidyExpense, tidyProgram, tidyTask } from './invitations.service';
import { PublicRsvpDTO, RsvpDTO } from './dtos/rsvp.dto';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';
import { UpdateInvitationDTO } from './dtos/updateInvitation.dto';
import { PhotoOrderDTO } from './dtos/photo.dto';
import { UpdateGuestDTO } from './dtos/updateGuest.dto';
import { ArrivalDTO, WalkInDTO } from './dtos/desk.dto';
import { GiftClaimDTO, GiftGiverDTO } from './dtos/receivedGift.dto';
import { SeatingDTO } from './dtos/seating.dto';
import { ExpenseDTO, UpdateExpenseDTO } from './dtos/expense.dto';
import { ChecklistDTO, UpdateTaskDTO } from './dtos/task.dto';
import { DuplicateEventDTO } from './dtos/duplicate.dto';

jest.mock('src/sharedServices/mailer.service', () => ({ MailerService: class {} }));

const HOST = '64b000000000000000000001';
const OTHER = '64b000000000000000000002';
const EVENT = '64b0000000000000000000e1';
const GUEST = '64b0000000000000000000a1';

/** Lets fire-and-forget work (deleting photo files) run. */
const flush = () => new Promise(resolve => setImmediate(resolve));

/** A thenable Mongoose query: chain methods return itself. */
function query(result: any) {
  const q: any = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const m of ['select', 'populate', 'sort', 'limit', 'skip', 'setOptions']) {
    q[m] = jest.fn(() => q);
  }
  return q;
}

function setup({ event = { _id: EVENT, startAt: new Date(Date.now() + 86400000) }, guest = { _id: GUEST, name: 'Minh', event: EVENT } } = {}) {
  const saved: any[] = [];
  const eventModel: any = jest.fn(function (doc) {
    this.doc = doc;
    this.save = jest.fn(async () => {
      saved.push(doc);
      return { _id: EVENT, ...doc };
    });
  });
  eventModel.findOne = jest.fn(() => query(event));
  eventModel.findOneAndUpdate = jest.fn(() => query(event));
  eventModel.updateOne = jest.fn(async () => ({ matchedCount: 1, modifiedCount: 1 }));
  // No other event shows a photo, unless a test says so
  eventModel.exists = jest.fn(async () => null);
  const guestModel: any = {
    findOne: jest.fn(() => query(guest)),
    findOneAndUpdate: jest.fn(() => query(guest)),
    updateOne: jest.fn(async () => ({ matchedCount: 1 })),
    updateMany: jest.fn(async () => ({ matchedCount: 1 })),
    create: jest.fn(async (doc) => ({ _id: 'new-guest', ...doc })),
    insertMany: jest.fn(async (docs) => docs.map((d, i) => ({ _id: `g${i}`, ...d }))),
  };
  const wishModel: any = {
    create: jest.fn(async (doc) => ({ _id: 'w1', createdAt: new Date(), ...doc })),
    find: jest.fn(() => query([])),
    updateOne: jest.fn(async () => ({ matchedCount: 1 })),
    updateMany: jest.fn(async () => ({ matchedCount: 1 })),
  };
  const session = { startTransaction: jest.fn(), commitTransaction: jest.fn(), abortTransaction: jest.fn(), endSession: jest.fn() };
  const connection: any = { startSession: jest.fn(async () => session) };
  const mailer: any = { sendInBackground: jest.fn() };
  const cloudinary: any = {
    uploadImage: jest.fn(async () => ({
      secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/FollMe/events/e1/a.jpg',
      public_id: 'FollMe/events/e1/a', width: 1600, height: 1067,
    })),
    destroy: jest.fn(async () => ({ result: 'ok' })),
  };
  const service = new InvitationsService(eventModel, guestModel, wishModel, connection, mailer, cloudinary);
  return { service, eventModel, guestModel, wishModel, mailer, cloudinary, saved };
}

describe('createOne', () => {
  it('stores only editable fields and the host, guests with their group', async () => {
    const setupRef = setup();
    const { service, saved, mailer } = setupRef;
    const body: any = {
      title: ' Lễ cưới Minh & Lan ', location: 'Hà Nội', startAt: '2027-01-10T10:00:00.000Z',
      type: 'wedding', theme: 'blush', groomName: 'Minh', brideName: 'Lan', allowPublicLink: true,
      host: 'attacker', publicViews: 999, isDeleted: true,
      guests: [{ name: 'An', email: 'an@example.com', group: ' Nhà  gái ' }, { name: 'Bình', group: ' ' }],
    };
    const { guestModel } = setupRef;
    await service.createOne(body, HOST, 'host@example.com');
    expect(guestModel.insertMany.mock.calls[0][0].map(g => [g.name, g.group])).toEqual([['An', 'Nhà gái'], ['Bình', undefined]]);
    expect(saved[0]).toEqual({
      title: 'Lễ cưới Minh & Lan', location: 'Hà Nội', startAt: '2027-01-10T10:00:00.000Z',
      type: 'wedding', theme: 'blush', groomName: 'Minh', brideName: 'Lan', allowPublicLink: true,
      host: HOST,
    });
    expect(mailer.sendInBackground).toHaveBeenCalledTimes(1);
  });

  it('keeps music, scratch-off and only the known fields of gift accounts', async () => {
    const { service, saved } = setup();
    const body: any = {
      title: 'Cưới', location: 'Huế', startAt: '2027-01-10T10:00:00.000Z',
      music: 'none', scratchDate: false,
      gifts: [{ side: 'groom', bankBin: '970436', accountNumber: ' 0123456789 ', accountName: 'nguyen van minh', note: 'x' }],
    };
    await service.createOne(body, HOST, 'host@example.com');
    expect(saved[0]).toMatchObject({
      music: 'none',
      scratchDate: false,
      gifts: [{ side: 'groom', bankBin: '970436', accountNumber: '0123456789', accountName: 'NGUYEN VAN MINH' }],
    });
  });
});

describe('RSVP', () => {
  it('saves the answer; declining brings nobody', async () => {
    const { service, guestModel } = setup();
    const res = await service.rsvpGuest(GUEST, { status: 'declined', count: 3, note: ' Chúc mừng! ' });
    expect(res.rsvp).toMatchObject({ status: 'declined', count: 0, note: 'Chúc mừng!' });
    expect(guestModel.updateOne).toHaveBeenCalledWith({ _id: GUEST }, { $set: { rsvp: res.rsvp } });
  });

  it('keeps the song a guest coming would like to hear', async () => {
    const { service } = setup();
    expect((await service.rsvpGuest(GUEST, { status: 'attending', song: '  Ngày   đầu tiên – Đức Phúc ' })).rsvp.song)
      .toBe('Ngày đầu tiên – Đức Phúc');
    expect((await service.rsvpGuest(GUEST, { status: 'declined', song: 'Hơn cả yêu' })).rsvp.song).toBeUndefined();
    expect((await service.rsvpGuest(GUEST, { status: 'maybe', song: '   ' })).rsvp.song).toBeUndefined();
    expect(await validate(plainToInstance(RsvpDTO, { status: 'attending', song: 'x'.repeat(101) }))).toHaveLength(1);
  });

  it('keeps how many eat vegetarian, never more than come', async () => {
    const { service } = setup();
    expect((await service.rsvpGuest(GUEST, { status: 'attending', count: 3, vegetarian: 2 })).rsvp.vegetarian).toBe(2);
    expect((await service.rsvpGuest(GUEST, { status: 'attending', count: 2, vegetarian: 5 })).rsvp.vegetarian).toBe(2);
    expect((await service.rsvpGuest(GUEST, { status: 'declined', vegetarian: 1 })).rsvp.vegetarian).toBeUndefined();
    expect((await service.rsvpGuest(GUEST, { status: 'attending', count: 2, vegetarian: 0 })).rsvp.vegetarian).toBeUndefined();
    const props = async body => (await validate(plainToInstance(PublicRsvpDTO, body))).map(e => e.property);
    expect(await props({ name: 'An', status: 'attending', count: 2, vegetarian: 1 })).toEqual([]);
    expect(await props({ name: 'An', status: 'attending', vegetarian: -1 })).toEqual(['vegetarian']);
    expect(await props({ name: 'An', status: 'attending', vegetarian: 1.5 })).toEqual(['vegetarian']);
  });

  it('refuses answers after the event started', async () => {
    const { service, guestModel } = setup({ event: { _id: EVENT, startAt: new Date(Date.now() - 1000) } });
    await expect(service.rsvpGuest(GUEST, { status: 'attending' })).rejects.toBeInstanceOf(BadRequestException);
    expect(guestModel.updateOne).not.toHaveBeenCalled();
  });

  it('404s for an unknown guest', async () => {
    const { service } = setup({ guest: null });
    await expect(service.rsvpGuest(GUEST, { status: 'attending' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('public answers need the public link to be on and create a guest', async () => {
    const { service, eventModel, guestModel } = setup();
    const res = await service.rsvpPublic(EVENT, { name: ' Cô Ba ', status: 'attending', count: 2 });
    expect(eventModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ _id: EVENT, allowPublicLink: true }));
    expect(guestModel.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cô Ba', source: 'public', event: EVENT }));
    expect(res.rsvp.count).toBe(2);
  });

  it('public answers 404 when the link is off', async () => {
    const { service } = setup({ event: null });
    await expect(service.rsvpPublic(EVENT, { name: 'X', status: 'attending' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates the body', async () => {
    const bad = plainToInstance(PublicRsvpDTO, { name: '', status: 'yes', count: 21 });
    const errors = (await validate(bad)).map(e => e.property).sort();
    expect(errors).toEqual(['count', 'name', 'status']);
    const ok = plainToInstance(PublicRsvpDTO, { name: 'An', status: 'maybe', count: 2 });
    expect(await validate(ok)).toEqual([]);
  });
});

describe('wishes', () => {
  it('uses the guest name on a personal link', async () => {
    const { service, wishModel } = setup();
    await service.wishFromGuest(GUEST, { message: ' Trăm năm hạnh phúc ', name: 'Someone else' });
    expect(wishModel.create).toHaveBeenCalledWith({ event: EVENT, guest: GUEST, name: 'Minh', message: 'Trăm năm hạnh phúc' });
  });

  it('requires a name on the public link', async () => {
    const { service, wishModel } = setup();
    await expect(service.wishFromPublic(EVENT, { message: 'Hi', name: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(wishModel.create).not.toHaveBeenCalled();
  });

  it('refuses a wish that is only spaces', async () => {
    const { service, wishModel } = setup();
    await expect(service.wishFromGuest(GUEST, { message: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(wishModel.create).not.toHaveBeenCalled();
  });

  it('only the host can hide a wish', async () => {
    const { service, wishModel } = setup({ event: null });
    await expect(service.setWishHidden(EVENT, '64b0000000000000000000f1', 'someone', true)).rejects.toBeInstanceOf(NotFoundException);
    expect(wishModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('summarize', () => {
  it('counts answers and headcount', () => {
    const s = summarize([
      { viewed: 2, sentAt: new Date(), rsvp: { status: 'attending', count: 2, vegetarian: 1 } },
      { viewed: 1, rsvp: { status: 'attending', count: 1 } },
      { viewed: 1, rsvp: { status: 'declined', count: 0 } },
      { viewed: 0, rsvp: { status: 'maybe', count: 1, vegetarian: 1 } },
      { viewed: 0 },
    ] as any);
    expect(s).toEqual({
      invited: 5, sent: 1, opened: 3, attending: 2, maybe: 1, declined: 1, pending: 1, headcount: 3, arrived: 0, arrivedPeople: 0,
      gifts: 0, giftTotal: 0, vegetarian: 1,
    });
  });

  it('counts who came, and never waits for an answer from a walk-in', () => {
    const s = summarize([
      { viewed: 1, rsvp: { status: 'attending', count: 2 }, arrivedAt: new Date(), arrivedCount: 3 },
      { viewed: 0, arrivedAt: new Date() },
      { viewed: 0, source: 'desk', arrivedAt: new Date(), arrivedCount: 2 },
    ] as any);
    expect(s).toMatchObject({ invited: 3, pending: 1, headcount: 2, arrived: 3, arrivedPeople: 6 });
  });
});

describe('CreateInvitationDTO', () => {
  const base = { title: 'T', location: 'L', startAt: '2027-01-01T00:00:00Z' };

  it('accepts up to two valid gift accounts', async () => {
    const ok = plainToInstance(CreateInvitationDTO, {
      ...base, music: 'canon', scratchDate: true,
      gifts: [
        { side: 'groom', bankBin: '970436', accountNumber: '0123456789', accountName: 'NGUYEN VAN MINH' },
        { side: 'bride', bankBin: '970407', accountNumber: '19031234567890' },
      ],
    });
    expect(await validate(ok)).toEqual([]);
  });

  it('rejects bad gift accounts, a third account and unknown music', async () => {
    const gift = { side: 'groom', bankBin: '970436', accountNumber: '0123456789' };
    const cases = [
      { gifts: [{ ...gift, bankBin: 'VCB' }] },
      { gifts: [{ ...gift, accountNumber: '12 34' }] },
      { gifts: [{ ...gift, side: 'friend' }] },
      { gifts: [gift, gift, gift] },
      { music: 'rock' },
    ];
    for (const extra of cases) {
      const dto = plainToInstance(CreateInvitationDTO, { ...base, ...extra });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    }
  });

  it('caps the guest list and guest names', async () => {
    const base = { title: 'T', location: 'L', startAt: '2027-01-01T00:00:00Z' };
    const many = plainToInstance(CreateInvitationDTO, { ...base, guests: Array.from({ length: 501 }, () => ({ name: 'A' })) });
    expect((await validate(many)).map(e => e.property)).toEqual(['guests']);
    const longName = plainToInstance(CreateInvitationDTO, { ...base, guests: [{ name: 'A'.repeat(101) }] });
    expect((await validate(longName)).map(e => e.property)).toEqual(['guests']);
    const longGroup = plainToInstance(CreateInvitationDTO, { ...base, guests: [{ name: 'A', group: 'G'.repeat(41) }] });
    expect((await validate(longGroup)).map(e => e.property)).toEqual(['guests']);
  });

  it('rejects unknown types and themes', async () => {
    const dto = plainToInstance(CreateInvitationDTO, { title: 'T', location: 'L', startAt: '2027-01-01T00:00:00Z', type: 'funeral', theme: 'neon' });
    expect((await validate(dto)).map(e => e.property).sort()).toEqual(['theme', 'type']);
    const garden = plainToInstance(CreateInvitationDTO, { title: 'T', location: 'L', startAt: '2027-01-01T00:00:00Z', theme: 'garden', guests: [] });
    expect(await validate(garden)).toEqual([]);
  });
});

describe('preview', () => {
  const wedding = {
    _id: EVENT, type: 'wedding', groomName: 'Minh', brideName: 'Lan', title: 'Lễ thành hôn',
    startAt: new Date('2027-02-06T04:00:00Z'), location: 'Hà Nội',
  };

  it('describes a personal invitation without counting a view', async () => {
    const { service, guestModel, eventModel } = setup({ guest: { _id: GUEST, name: 'Anh Tuấn', event: wedding } as any });
    const res = await service.preview('guest', GUEST);
    expect(res).toEqual({
      title: 'Thiệp cưới Minh & Lan',
      description: 'Trân trọng kính mời Anh Tuấn. · 11:00 thứ Bảy, 6/2/2027 · Hà Nội',
      type: 'wedding',
    });
    expect(guestModel.findOne).toHaveBeenCalled();
    expect(eventModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('only previews public events that allow it', async () => {
    const { service, eventModel } = setup({ event: null });
    await expect(service.preview('event', EVENT)).rejects.toBeInstanceOf(NotFoundException);
    expect(eventModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ allowPublicLink: true }));
  });

  it('falls back to the title for other events', async () => {
    const { service } = setup({ event: { _id: EVENT, type: 'birthday', title: 'Sinh nhật Vy', location: 'Q1' } as any });
    const res = await service.preview('event', EVENT);
    expect(res.title).toBe('Thiệp mời: Sinh nhật Vy');
    expect(res.description).toBe('Q1');
  });
});

describe('photos', () => {
  const PHOTO_A = '64b0000000000000000000c1';
  const PHOTO_B = '64b0000000000000000000c2';
  const file: any = { buffer: Buffer.from('x'), mimetype: 'image/jpeg' };

  it('uploads into the event folder and appends to the album', async () => {
    const { service, eventModel, cloudinary } = setup({ event: { _id: EVENT, photos: [] } as any });
    const photo = await service.addPhoto(EVENT, HOST, file);
    expect(cloudinary.uploadImage).toHaveBeenCalledWith(file, `FollMe/events/${EVENT}`);
    expect(photo).toMatchObject({ publicId: 'FollMe/events/e1/a', width: 1600, height: 1067 });
    const [filter, update] = eventModel.updateOne.mock.calls[0];
    expect(filter).toMatchObject({ _id: EVENT, $or: [{ host: HOST }, { cohosts: HOST }], 'photos.11': { $exists: false } });
    expect(update).toEqual({ $push: { photos: photo } });
  });

  it('refuses a 13th photo before uploading it', async () => {
    const full = Array.from({ length: 12 }, (_, i) => ({ _id: `p${i}` }));
    const { service, cloudinary } = setup({ event: { _id: EVENT, photos: full } as any });
    await expect(service.addPhoto(EVENT, HOST, file)).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('deletes the upload when the album filled up meanwhile', async () => {
    const { service, eventModel, cloudinary } = setup({ event: { _id: EVENT, photos: [] } as any });
    eventModel.updateOne.mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });
    await expect(service.addPhoto(EVENT, HOST, file)).rejects.toBeInstanceOf(BadRequestException);
    await flush();
    expect(cloudinary.destroy).toHaveBeenCalledWith('FollMe/events/e1/a');
  });

  it('only the host can upload', async () => {
    const { service, cloudinary } = setup({ event: null });
    await expect(service.addPhoto(EVENT, 'someone', file)).rejects.toBeInstanceOf(NotFoundException);
    expect(cloudinary.uploadImage).not.toHaveBeenCalled();
  });

  it('removes a photo and its file', async () => {
    const event: any = { _id: EVENT, photos: [{ _id: PHOTO_A, publicId: 'FollMe/events/e1/a' }] };
    const { service, eventModel, cloudinary } = setup({ event });
    await service.removePhoto(EVENT, PHOTO_A, HOST);
    expect(eventModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ $or: [{ host: HOST }, { cohosts: HOST }], 'photos._id': PHOTO_A }),
      { $pull: { photos: { _id: PHOTO_A } } },
    );
    await flush();
    expect(cloudinary.destroy).toHaveBeenCalledWith('FollMe/events/e1/a');
  });

  it('reorders only with every photo listed once', async () => {
    const photos = [{ _id: PHOTO_A, url: 'a' }, { _id: PHOTO_B, url: 'b' }];
    const { service, eventModel } = setup({ event: { _id: EVENT, photos } as any });
    await service.orderPhotos(EVENT, HOST, [PHOTO_B, PHOTO_A]);
    expect(eventModel.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ photos: { $size: 2 } }),
      { $set: { photos: [photos[1], photos[0]] } },
    );
    for (const order of [[PHOTO_A], [PHOTO_A, PHOTO_A], [PHOTO_A, '64b0000000000000000000c9']]) {
      await expect(service.orderPhotos(EVENT, HOST, order)).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('validates the order body', async () => {
    const bad = plainToInstance(PhotoOrderDTO, { order: ['nope'] });
    expect((await validate(bad)).map(e => e.property)).toEqual(['order']);
  });

  it('crops the cover for link previews', () => {
    expect(ogImage('https://res.cloudinary.com/x/image/upload/v1/a.jpg'))
      .toBe('https://res.cloudinary.com/x/image/upload/c_fill,g_faces,w_1200,h_630,q_auto,f_jpg/v1/a.jpg');
    expect(ogImage('https://example.com/a.jpg')).toBeUndefined();
    expect(ogImage(undefined)).toBeUndefined();
  });

  it('previews with the cover photo', async () => {
    const event: any = {
      _id: EVENT, type: 'wedding', groomName: 'Minh', brideName: 'Lan', title: 'T',
      photos: [{ url: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' }],
    };
    const { service } = setup({ event });
    const res = await service.preview('event', EVENT);
    expect(res.image).toContain('/image/upload/c_fill,g_faces,w_1200,h_630');
  });
});

describe('venue screen', () => {
  const KEY = 'a'.repeat(32);

  it('makes a key once and keeps it', async () => {
    const { service, eventModel } = setup({ event: { _id: EVENT } as any });
    eventModel.findOne
      .mockReturnValueOnce(query({ _id: EVENT }))
      .mockReturnValueOnce(query({ _id: EVENT, screenKey: KEY }));
    expect(await service.screenKey(EVENT, HOST)).toEqual({ key: KEY });
    expect(eventModel.updateOne.mock.calls[0][0]).toMatchObject({ screenKey: { $exists: false } });

    const again = setup({ event: { _id: EVENT, screenKey: KEY } as any });
    expect(await again.service.screenKey(EVENT, HOST)).toEqual({ key: KEY });
    expect(again.eventModel.updateOne).not.toHaveBeenCalled();
  });

  it('rotates the key on request', async () => {
    const { service, eventModel } = setup({ event: { _id: EVENT, screenKey: KEY } as any });
    const { key } = await service.screenKey(EVENT, HOST, true);
    expect(key).toMatch(/^[a-f0-9]{32}$/);
    expect(key).not.toBe(KEY);
    expect(eventModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ $or: [{ host: HOST }, { cohosts: HOST }] }), { $set: { screenKey: key } });
  });

  it('needs the right key', async () => {
    const { service, eventModel } = setup();
    await expect(service.screen(EVENT, 'short')).rejects.toBeInstanceOf(NotFoundException);
    expect(eventModel.findOne).not.toHaveBeenCalled();
    await service.screen(EVENT, KEY);
    expect(eventModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ _id: EVENT, screenKey: KEY }));

    const wrong = setup({ event: null });
    await expect(wrong.service.screen(EVENT, KEY)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('polls wishes changed since the cursor, hidden ones included', async () => {
    const { service, wishModel } = setup();
    const since = '2027-01-10T10:00:00.000Z';
    const res = await service.screen(EVENT, KEY, since);
    expect(wishModel.find).toHaveBeenCalledWith({ event: EVENT, updatedAt: { $gte: new Date(since) } });
    expect(Date.parse(res.cursor)).toBeLessThan(Date.now());
    await expect(service.screen(EVENT, KEY, 'yesterday')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('reception desk', () => {
  const KEY = 'b'.repeat(32);

  function deskSetup(opts = {}) {
    const ctx = setup(opts);
    ctx.guestModel.find = jest.fn(() => query([{ _id: GUEST, name: 'Minh' }]));
    return ctx;
  }

  it('has its own key, separate from the screen\'s', async () => {
    const { service, eventModel } = setup({ event: { _id: EVENT, screenKey: 'a'.repeat(32) } as any });
    eventModel.findOne
      .mockReturnValueOnce(query({ _id: EVENT, screenKey: 'a'.repeat(32) }))
      .mockReturnValueOnce(query({ _id: EVENT, deskKey: KEY }));
    expect(await service.deskKey(EVENT, HOST)).toEqual({ key: KEY });
    expect(eventModel.findOne.mock.results[0].value.select).toHaveBeenCalledWith('_id +deskKey');
    expect(eventModel.updateOne.mock.calls[0][0]).toMatchObject({ $or: [{ host: HOST }, { cohosts: HOST }], deskKey: { $exists: false } });

    const rotated = setup({ event: { _id: EVENT, deskKey: KEY } as any });
    const { key } = await rotated.service.deskKey(EVENT, HOST, true);
    expect(key).not.toBe(KEY);
    expect(rotated.eventModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ $or: [{ host: HOST }, { cohosts: HOST }] }), { $set: { deskKey: key } });
  });

  it('lists the guests by the desk key, without emails or notes', async () => {
    const { service, eventModel, guestModel } = deskSetup();
    const res = await service.desk(EVENT, KEY);
    expect(eventModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ _id: EVENT, deskKey: KEY, isDeleted: { $ne: true } }));
    expect(guestModel.find).toHaveBeenCalledWith({ event: EVENT, isDeleted: { $ne: true } });
    const fields = guestModel.find.mock.results[0].value.select.mock.calls[0][0];
    expect(fields).toContain('arrivedAt');
    expect(fields).not.toMatch(/mail|note|viewed|\brsvp\b(?!\.)/);
    expect(res.guests).toHaveLength(1);
  });

  it('needs the right key for everything', async () => {
    const short = deskSetup();
    await expect(short.service.desk(EVENT, 'short')).rejects.toBeInstanceOf(NotFoundException);
    await expect(short.service.setArrival(EVENT, 'x', GUEST, { arrived: true })).rejects.toBeInstanceOf(NotFoundException);
    expect(short.eventModel.findOne).not.toHaveBeenCalled();

    const wrong = deskSetup({ event: null });
    await expect(wrong.service.desk(EVENT, KEY)).rejects.toBeInstanceOf(NotFoundException);
    await expect(wrong.service.setArrival(EVENT, KEY, GUEST, { arrived: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(wrong.service.addWalkIn(EVENT, KEY, { name: 'Ba' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(wrong.service.removeWalkIn(EVENT, KEY, GUEST)).rejects.toBeInstanceOf(NotFoundException);
    expect(wrong.guestModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(wrong.guestModel.create).not.toHaveBeenCalled();
  });

  it('checks a guest of this event in, keeping the first arrival time', async () => {
    const { service, guestModel } = deskSetup();
    await service.setArrival(EVENT, KEY, GUEST, { arrived: true, count: 3 });
    const [filter, update] = guestModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: GUEST, event: EVENT, isDeleted: { $ne: true } });
    expect(update[0].$set.arrivedAt.$ifNull[0]).toBe('$arrivedAt');
    expect(update[0].$set.arrivedCount).toBe(3);

    await service.setArrival(EVENT, KEY, GUEST, { arrived: true });
    expect(guestModel.findOneAndUpdate.mock.calls[1][1][0].$set.arrivedCount).toEqual({ $ifNull: ['$arrivedCount', 1] });
  });

  it('seats a guest on the way in, or takes them off their table', async () => {
    const { service, guestModel } = deskSetup();
    await service.setArrival(EVENT, KEY, GUEST, { arrived: true, count: 2, table: ' 7 ' });
    await service.setArrival(EVENT, KEY, GUEST, { arrived: true, table: '' });
    await service.setArrival(EVENT, KEY, GUEST, { arrived: true });
    const sets = guestModel.findOneAndUpdate.mock.calls.map(c => c[1][0].$set);
    expect(sets[0].table).toBe('7');
    expect(sets[1].table).toBe('$$REMOVE');
    expect('table' in sets[2]).toBe(false);
  });

  it('seats a walk-in', async () => {
    const { service, guestModel } = deskSetup();
    const res: any = await service.addWalkIn(EVENT, KEY, { name: 'Ba', table: ' VIP ' });
    expect(guestModel.create.mock.calls[0][0].table).toBe('VIP');
    expect(res.table).toBe('VIP');
  });

  it('undoes a check-in', async () => {
    const { service, guestModel } = deskSetup();
    await service.setArrival(EVENT, KEY, GUEST, { arrived: false });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1]).toEqual({ $unset: { arrivedAt: 1, arrivedCount: 1 } });
  });

  it('404s for a guest of another event', async () => {
    const { service } = deskSetup({ guest: null });
    await expect(service.setArrival(EVENT, KEY, GUEST, { arrived: true })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('adds a walk-in, checked in, and can take it back', async () => {
    const { service, guestModel } = deskSetup();
    const res: any = await service.addWalkIn(EVENT, KEY, { name: '  Chú   Ba ', count: 2, group: ' Bạn  bố ' });
    const doc = guestModel.create.mock.calls[0][0];
    expect(doc).toMatchObject({ event: EVENT, name: 'Chú Ba', group: 'Bạn bố', source: 'desk', arrivedCount: 2 });
    expect(doc.arrivedAt).toBeInstanceOf(Date);
    expect(res).toMatchObject({ name: 'Chú Ba', source: 'desk', arrivedCount: 2 });
    await expect(service.addWalkIn(EVENT, KEY, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);

    await service.removeWalkIn(EVENT, KEY, GUEST);
    expect(guestModel.updateOne.mock.calls[0][0]).toMatchObject({ _id: GUEST, event: EVENT, source: 'desk' });
    expect(guestModel.updateOne.mock.calls[0][1].$set.deletedAt).toBeInstanceOf(Date);
  });

  it('only removes walk-ins', async () => {
    const { service, guestModel } = deskSetup();
    guestModel.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
    await expect(service.removeWalkIn(EVENT, KEY, GUEST)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('validates the bodies', async () => {
    const bad = await validate(plainToInstance(ArrivalDTO, { arrived: 'yes', count: 0 }));
    expect(bad.map(e => e.property).sort()).toEqual(['arrived', 'count']);
    expect(await validate(plainToInstance(ArrivalDTO, { arrived: true, count: 21 }))).toHaveLength(1);
    expect(await validate(plainToInstance(WalkInDTO, { name: 'Ba', count: 2, group: 'Bạn bố' }))).toHaveLength(0);
    expect(await validate(plainToInstance(WalkInDTO, { name: '', group: 'x'.repeat(41) }))).toHaveLength(2);
  });
});

describe('seating', () => {
  it('seats a guest at a tidied table, or takes them off it', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { table: '  Bàn   3 ' });
    await service.updateGuest(EVENT, GUEST, HOST, { table: ' ' });
    expect(guestModel.findOneAndUpdate.mock.calls.map(c => c[1])).toEqual([{ $set: { table: 'Bàn 3' } }, { $unset: { table: 1 } }]);
  });

  it('seats many guests at once, only of this event', async () => {
    const { service, guestModel } = setup();
    guestModel.bulkWrite = jest.fn(async ops => ({ matchedCount: ops.length }));
    const res = await service.seatGuests(EVENT, HOST, [{ guest: GUEST, table: ' 12 ' }, { guest: 'g2', table: '' }]);
    expect(res).toEqual({ updated: 2 });
    expect(guestModel.bulkWrite.mock.calls[0][0]).toEqual([
      { updateOne: { filter: { _id: GUEST, event: EVENT, isDeleted: { $ne: true } }, update: { $set: { table: '12' } } } },
      { updateOne: { filter: { _id: 'g2', event: EVENT, isDeleted: { $ne: true } }, update: { $unset: { table: 1 } } } },
    ]);
    expect(await service.seatGuests(EVENT, HOST, [])).toEqual({ updated: 0 });
  });

  it('only the host seats guests', async () => {
    const { service, guestModel } = setup({ event: null });
    guestModel.bulkWrite = jest.fn();
    await expect(service.seatGuests(EVENT, 'someone', [{ guest: GUEST, table: '1' }])).rejects.toBeInstanceOf(NotFoundException);
    expect(guestModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('the desk and the guest see the table', async () => {
    const { service, guestModel } = setup();
    guestModel.find = jest.fn(() => query([]));
    await service.desk(EVENT, 'c'.repeat(32));
    expect(guestModel.find.mock.results[0].value.select.mock.calls[0][0]).toContain('table');
  });

  it('keeps and clears the answer-by date', async () => {
    const { service, saved, eventModel } = setup();
    await service.createOne({ title: 'A', location: 'B', rsvpBy: '2027-01-09T16:59:59.000Z', guests: [] } as any, HOST, 'h@x');
    expect(saved[0].rsvpBy).toBe('2027-01-09T16:59:59.000Z');
    await service.update(EVENT, HOST, { rsvpBy: null } as any, 'h@x');
    expect(eventModel.findOneAndUpdate.mock.calls[0][1].$set).toEqual({ rsvpBy: null });
    const props = async rsvpBy => (await validate(plainToInstance(UpdateInvitationDTO, { rsvpBy }))).map(e => e.property);
    expect(await props(null)).toEqual([]);
    expect(await props('09/01/2027')).toEqual(['rsvpBy']);
  });

  it('keeps seats per table among the editable fields', async () => {
    const { service, saved } = setup();
    await service.createOne({ title: 'A', location: 'B', seatsPerTable: 12, guests: [] } as any, HOST, 'h@x');
    expect(saved[0].seatsPerTable).toBe(12);
  });

  it('validates tables and seats', async () => {
    expect(await validate(plainToInstance(UpdateGuestDTO, { table: 'x'.repeat(21) }))).toHaveLength(1);
    expect(await validate(plainToInstance(SeatingDTO, { seats: [{ guest: GUEST, table: '1' }] }))).toHaveLength(0);
    expect(await validate(plainToInstance(SeatingDTO, { seats: [{ guest: 'nope', table: '1' }] }))).toHaveLength(1);
    const props = async seatsPerTable => (await validate(plainToInstance(CreateInvitationDTO, { title: 'A', location: 'B', startAt: '2027-01-16T04:00:00.000Z', guests: [], seatsPerTable })))
      .map(e => e.property);
    expect(await props(10)).toEqual([]);
    expect(await props(1)).toEqual(['seatsPerTable']);
    expect(await props(31)).toEqual(['seatsPerTable']);
  });
});

describe('program', () => {
  it('keeps the program tidied, in time order', async () => {
    const { service, saved, eventModel } = setup();
    const program = [
      { time: '18:00', label: ' Khai   tiệc ' },
      { time: '17:00', label: 'Đón khách', extra: 'x' },
      { time: '17:30', label: '   ' },
      { time: '17:00', label: 'Chụp ảnh' },
    ];
    await service.createOne({ title: 'A', location: 'B', program, guests: [] } as any, HOST, 'h@x');
    expect(saved[0].program).toEqual([
      { time: '17:00', label: 'Đón khách' },
      { time: '17:00', label: 'Chụp ảnh' },
      { time: '18:00', label: 'Khai tiệc' },
    ]);
    await service.update(EVENT, HOST, { program: [] } as any, 'h@x');
    expect(eventModel.findOneAndUpdate.mock.calls[0][1].$set).toEqual({ program: [] });
    expect(tidyProgram([])).toEqual([]);
  });

  it('guests, the venue screen and the desk see it', async () => {
    const { service, guestModel, eventModel } = setup();
    guestModel.findOne = jest.fn(() => query(null));
    await service.findGuest(GUEST).catch(() => null);
    expect(guestModel.findOne.mock.results[0].value.populate.mock.calls[0][1]).toContain('program');
    guestModel.find = jest.fn(() => query([]));
    await service.desk(EVENT, 'c'.repeat(32));
    expect(eventModel.findOne.mock.results[0].value.select.mock.calls[0][0]).toContain('program');
  });

  it('validates times, labels and length', async () => {
    const props = async program => (await validate(plainToInstance(UpdateInvitationDTO, { program })))
      .map(e => e.property);
    expect(await props([{ time: '07:05', label: 'Lễ gia tiên' }, { time: '23:59', label: 'x' }])).toEqual([]);
    expect(await props([{ time: '24:00', label: 'x' }])).toEqual(['program']);
    expect(await props([{ time: '7:00', label: 'x' }])).toEqual(['program']);
    expect(await props([{ time: '18:00', label: '' }])).toEqual(['program']);
    expect(await props([{ time: '18:00', label: 'x'.repeat(61) }])).toEqual(['program']);
    expect(await props(Array.from({ length: 9 }, () => ({ time: '18:00', label: 'x' })))).toEqual(['program']);
    expect(await props('18:00 Khai tiệc')).toEqual(['program']);
  });
});

describe('budget', () => {
  const EXPENSE = '64b0000000000000000000c1';

  it('adds a tidied line, unless the list is full or the event not theirs', async () => {
    const { service, eventModel } = setup();
    const added: any = await service.addExpense(EVENT, HOST, { label: ' Tiệc   cưới ', category: 'venue', amount: 150000000, note: ' ', extra: 1 } as any);
    expect(added).toMatchObject({ label: 'Tiệc cưới', category: 'venue', amount: 150000000 });
    expect(added.note).toBeUndefined();
    expect(added.extra).toBeUndefined();
    const [filter, update] = eventModel.updateOne.mock.calls[0];
    expect(filter).toMatchObject({ _id: EVENT, $or: [{ host: HOST }, { cohosts: HOST }], 'expenses.99': { $exists: false } });
    expect(update.$push.expenses).toMatchObject({ label: 'Tiệc cưới', category: 'venue' });

    eventModel.updateOne = jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 }));
    await expect(service.addExpense(EVENT, HOST, { label: 'Nhẫn', category: 'rings' } as any)).rejects.toBeInstanceOf(BadRequestException);
    eventModel.findOne = jest.fn(() => query(null));
    await expect(service.addExpense(EVENT, 'someone', { label: 'Nhẫn', category: 'rings' } as any)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.addExpense(EVENT, HOST, { label: '   ', category: 'rings' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('changes only the given fields; null clears the cost', async () => {
    const { service, eventModel } = setup();
    eventModel.findOneAndUpdate = jest.fn(() => query({ expenses: [{ _id: EXPENSE, label: 'Ảnh cưới', paid: 5000000 }] }));
    const saved = await service.updateExpense(EVENT, EXPENSE, HOST, { paid: 5000000, amount: null, note: '' });
    expect(saved).toMatchObject({ _id: EXPENSE, paid: 5000000 });
    const [filter, update] = eventModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: EVENT, $or: [{ host: HOST }, { cohosts: HOST }], 'expenses._id': EXPENSE });
    expect(update.$set).toMatchObject({ 'expenses.$.paid': 5000000 });
    expect(update.$unset).toEqual({ 'expenses.$.amount': '', 'expenses.$.note': '' });
    expect(update.$set['expenses.$.label']).toBeUndefined();
  });

  it('says who pays a line, and clears it', async () => {
    const { service, eventModel } = setup();
    eventModel.findOneAndUpdate = jest.fn(() => query({ expenses: [{ _id: EXPENSE, label: 'Ảnh cưới', payer: 'bride' }] }));
    await service.updateExpense(EVENT, EXPENSE, HOST, { payer: 'bride' });
    expect(eventModel.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({ 'expenses.$.payer': 'bride' });
    await service.updateExpense(EVENT, EXPENSE, HOST, { payer: null });
    expect(eventModel.findOneAndUpdate.mock.calls[1][1].$unset).toEqual({ 'expenses.$.payer': '' });
    const props = async body => (await validate(plainToInstance(UpdateExpenseDTO, body))).map(e => e.property);
    expect(await props({ payer: 'shared' })).toEqual([]);
    expect(await props({ payer: 'aunt' })).toEqual(['payer']);
  });

  it('never clears what a line is for, and 404s for another event', async () => {
    const { service, eventModel } = setup();
    await expect(service.updateExpense(EVENT, EXPENSE, HOST, { label: ' ' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateExpense(EVENT, EXPENSE, HOST, { category: null } as any)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateExpense(EVENT, EXPENSE, HOST, {})).rejects.toBeInstanceOf(BadRequestException);
    eventModel.findOneAndUpdate = jest.fn(() => query(null));
    await expect(service.updateExpense(EVENT, EXPENSE, 'someone', { paid: 1 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a line of the host\'s event only', async () => {
    const { service, eventModel } = setup();
    await service.removeExpense(EVENT, EXPENSE, HOST);
    expect(eventModel.updateOne.mock.calls[0][1]).toEqual({ $pull: { expenses: { _id: EXPENSE } } });
    eventModel.updateOne = jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 }));
    await expect(service.removeExpense(EVENT, EXPENSE, 'someone')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps the planned total among the editable fields', async () => {
    const { service, saved, eventModel } = setup();
    await service.createOne({ title: 'A', location: 'B', budget: 300000000, guests: [] } as any, HOST, 'h@x');
    expect(saved[0].budget).toBe(300000000);
    await service.update(EVENT, HOST, { budget: null } as any, 'h@x');
    expect(eventModel.findOneAndUpdate.mock.calls[0][1].$set).toEqual({ budget: null });
  });

  it('only the host view asks for the expenses', async () => {
    const { service, eventModel, guestModel, wishModel } = setup();
    eventModel.findOne = jest.fn(() => query(null));
    await service.findOne(EVENT, HOST).catch(() => null);
    expect(eventModel.findOne.mock.results[0].value.select.mock.calls[0][0]).toContain('+expenses');
    guestModel.findOne = jest.fn(() => query(null));
    await service.findGuest(GUEST).catch(() => null);
    expect(guestModel.findOne.mock.results[0].value.populate.mock.calls[0][1]).not.toContain('expenses');
    expect(wishModel).toBeDefined();
  });

  it('validates lines', async () => {
    const props = async body => (await validate(plainToInstance(ExpenseDTO, body))).map(e => e.property);
    expect(await props({ label: 'Tiệc', category: 'venue', amount: 1, paid: 0 })).toEqual([]);
    expect(await props({ label: '', category: 'venue' })).toEqual(['label']);
    expect(await props({ label: 'x'.repeat(61), category: 'venue' })).toEqual(['label']);
    expect(await props({ label: 'Tiệc', category: 'food' })).toEqual(['category']);
    expect(await props({ label: 'Tiệc', category: 'venue', amount: -1, paid: 1.5 })).toEqual(['amount', 'paid']);
    const update = async body => (await validate(plainToInstance(UpdateExpenseDTO, body))).map(e => e.property);
    expect(await update({ amount: null, paid: null, note: null })).toEqual([]);
    expect(await update({ note: 'x'.repeat(101) })).toEqual(['note']);
    expect(tidyExpense({ label: ' a  b ', note: '  ' })).toEqual({ label: 'a b', category: undefined, amount: undefined, paid: undefined, note: undefined });
  });
});

describe('managing an event together', () => {
  const KEY = 'ab'.repeat(16);

  it('lets the host and co-hosts manage, never anyone else', async () => {
    expect(owned(HOST)).toEqual({ $or: [{ host: HOST }, { cohosts: HOST }] });
    const { service, eventModel } = setup();
    await service.update(EVENT, OTHER, { title: 'Mới' } as any, 'x@y');
    expect(eventModel.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ _id: EVENT, $or: [{ host: OTHER }, { cohosts: OTHER }] });
    eventModel.find = jest.fn(() => query([]));
    await service.getList(OTHER);
    expect(eventModel.find.mock.calls[0][0]).toMatchObject({ $or: [{ host: OTHER }, { cohosts: OTHER }] });
  });

  it('only the host deletes the event or hands out the link', async () => {
    const { service, eventModel } = setup();
    eventModel.findOneAndUpdate = jest.fn(() => query(null));
    await expect(service.remove(EVENT, OTHER)).rejects.toBeInstanceOf(NotFoundException);
    expect(eventModel.findOneAndUpdate.mock.calls[0][0]).toMatchObject({ host: OTHER });
    expect(eventModel.findOneAndUpdate.mock.calls[0][0].$or).toBeUndefined();
    eventModel.findOne = jest.fn(() => query(null));
    await expect(service.cohostKey(EVENT, OTHER)).rejects.toBeInstanceOf(NotFoundException);
    expect(eventModel.findOne.mock.calls[0][0]).toMatchObject({ host: OTHER });
  });

  it('adds whoever opens the link, within the limit', async () => {
    const { service, eventModel } = setup({ event: { _id: EVENT, title: 'Cưới', host: HOST, cohosts: [] } as any });
    expect(await service.joinAsCohost(EVENT, KEY, OTHER)).toEqual({ _id: EVENT, title: 'Cưới' });
    expect(eventModel.findOne.mock.calls[0][0]).toMatchObject({ _id: EVENT, cohostKey: KEY });
    const [filter, update] = eventModel.updateOne.mock.calls[0];
    expect(filter).toMatchObject({ cohostKey: KEY, 'cohosts.2': { $exists: false } });
    expect(update).toEqual({ $addToSet: { cohosts: OTHER } });
    eventModel.updateOne = jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 }));
    await expect(service.joinAsCohost(EVENT, KEY, OTHER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('says what the link is for, without guest data', async () => {
    const { service, eventModel } = setup({ event: { _id: EVENT, title: 'Cưới', host: { _id: HOST, name: 'Lan' }, cohosts: [OTHER] } as any });
    expect(await service.cohostInvite(EVENT, KEY)).toMatchObject({ title: 'Cưới', hostName: 'Lan', hostId: HOST, cohosts: [OTHER], full: false });
    expect(eventModel.findOne.mock.calls[0][0]).toMatchObject({ _id: EVENT, cohostKey: KEY });
    expect(eventModel.findOne.mock.results[0].value.select.mock.calls[0][0]).not.toMatch(/guests|gifts|expenses/);
    await expect(service.cohostInvite(EVENT, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does nothing for the host or a co-host, refuses a wrong key', async () => {
    const { service, eventModel } = setup({ event: { _id: EVENT, title: 'Cưới', host: HOST, cohosts: [OTHER] } as any });
    await service.joinAsCohost(EVENT, KEY, HOST);
    await service.joinAsCohost(EVENT, KEY, OTHER);
    expect(eventModel.updateOne).not.toHaveBeenCalled();
    await expect(service.joinAsCohost(EVENT, 'nope', OTHER)).rejects.toBeInstanceOf(NotFoundException);
    eventModel.findOne = jest.fn(() => query(null));
    await expect(service.joinAsCohost(EVENT, KEY, OTHER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the host takes a co-host off; a co-host can only leave', async () => {
    const { service, eventModel } = setup();
    await service.removeCohost(EVENT, OTHER, HOST);
    expect(eventModel.updateOne.mock.calls[0]).toEqual([
      { _id: EVENT, isDeleted: { $ne: true }, host: HOST, cohosts: OTHER }, { $pull: { cohosts: OTHER } },
    ]);
    await service.removeCohost(EVENT, OTHER, OTHER);
    expect(eventModel.updateOne.mock.calls[1][0]).toMatchObject({ $or: [{ host: OTHER }, { cohosts: OTHER }], cohosts: OTHER });
    eventModel.updateOne = jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 }));
    await expect(service.removeCohost(EVENT, HOST, OTHER)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a co-host opening a guest card is not a guest view', async () => {
    const asDoc = (fields: any) => ({ ...fields, toJSON: () => ({ ...fields }) });
    const event = asDoc({ _id: EVENT, host: HOST, cohosts: [OTHER], isDeleted: false, title: 'Cưới' });
    const { service, guestModel, wishModel } = setup();
    guestModel.findOne = jest.fn(() => query(asDoc({ _id: GUEST, name: 'Minh', event })));
    wishModel.find = jest.fn(() => query([]));
    const card: any = await service.findGuest(GUEST, OTHER);
    expect(guestModel.updateOne).not.toHaveBeenCalled();
    expect(card.event.cohosts).toBeUndefined();
    expect(card.event.host).toBeUndefined();
  });
});

describe('copies of an event', () => {
  const source = {
    _id: EVENT, title: 'Lễ thành hôn', location: 'Nhà trai, Huế', mapLocation: 'https://maps.app/x', startAt: new Date('2027-01-16T04:00:00Z'),
    type: 'wedding', theme: 'garden', groomName: 'Minh', brideName: 'Lan', message: 'Mời bạn', allowPublicLink: true,
    music: 'canon', scratchDate: true, seatsPerTable: 12, gifts: [{ side: 'groom', bankBin: '970436', accountNumber: '0011', accountName: 'MINH' }],
    program: [{ time: '11:00', label: 'Đón khách' }],
    photos: [{ _id: 'p1', url: 'https://res.cloudinary.com/x/a.jpg', publicId: 'FollMe/events/e1/a', width: 800, height: 1000 }],
    publicViews: 40, rsvpBy: new Date('2027-01-09T16:59:59Z'), screenKey: 'k',
  };

  it('copies the look and the photos, with its own title, time and place', async () => {
    const { service, saved, eventModel } = setup({ event: source as any });
    const res = await service.duplicate(EVENT, HOST, {
      title: ' Lễ vu quy ', startAt: '2027-01-15T02:00:00.000Z', location: 'Nhà gái, Huế',
    });
    expect(res).toEqual({ _id: EVENT, guests: 0 });
    expect(eventModel.findOne.mock.calls[0][0]).toMatchObject({ _id: EVENT, $or: [{ host: HOST }, { cohosts: HOST }] });
    const copy = saved[0];
    expect(copy).toMatchObject({
      host: HOST, title: 'Lễ vu quy', startAt: '2027-01-15T02:00:00.000Z', location: 'Nhà gái, Huế', mapLocation: '',
      theme: 'garden', groomName: 'Minh', seatsPerTable: 12, program: source.program, gifts: source.gifts,
    });
    expect(copy.photos).toEqual([{ url: source.photos[0].url, publicId: 'FollMe/events/e1/a', width: 800, height: 1000 }]);
    for (const field of ['publicViews', 'rsvpBy', 'screenKey', 'isDeleted', '_id']) {
      expect(copy[field]).toBeUndefined();
    }
  });

  it('keeps everything as it is when nothing is given, the map link too', async () => {
    const { service, saved } = setup({ event: source as any });
    await service.duplicate(EVENT, HOST, { location: 'Nhà trai, Huế' });
    expect(saved[0]).toMatchObject({ title: 'Lễ thành hôn', location: 'Nhà trai, Huế', mapLocation: 'https://maps.app/x' });
  });

  it('invites the same guests, not walk-ins, answers or the ledger, and mails nobody', async () => {
    const { service, guestModel, mailer } = setup({ event: source as any });
    guestModel.find = jest.fn(() => query([{ name: 'Cô Ba', mail: 'ba@x.vn', group: 'Nhà gái' }, { name: 'Chú Tư' }]));
    const res = await service.duplicate(EVENT, HOST, { copyGuests: true });
    expect(res.guests).toBe(2);
    expect(guestModel.find.mock.calls[0][0]).toMatchObject({ event: EVENT, $or: [{ source: 'host' }, { source: { $exists: false } }] });
    expect(guestModel.insertMany.mock.calls[0][0]).toEqual([
      { event: EVENT, name: 'Cô Ba', mail: 'ba@x.vn', group: 'Nhà gái', source: 'host' },
      { event: EVENT, name: 'Chú Tư', mail: undefined, group: undefined, source: 'host' },
    ]);
    expect(mailer.sendInBackground).not.toHaveBeenCalled();
  });

  it('only the host copies, and the body is checked', async () => {
    const { service } = setup({ event: null });
    await expect(service.duplicate(EVENT, 'someone', {})).rejects.toBeInstanceOf(NotFoundException);
    const props = async body => (await validate(plainToInstance(DuplicateEventDTO, body))).map(e => e.property);
    expect(await props({ title: 'Lễ vu quy', startAt: '2027-01-15T02:00:00.000Z', copyGuests: true })).toEqual([]);
    expect(await props({ title: '', startAt: 'mai', copyGuests: 'yes' })).toEqual(['title', 'startAt', 'copyGuests']);
  });

  it('keeps a shared photo file while another event shows it', async () => {
    const { service, eventModel, cloudinary } = setup({ event: { _id: EVENT, photos: [{ _id: 'p1', publicId: 'FollMe/events/e1/a' }] } as any });
    eventModel.findOneAndUpdate = jest.fn(() => query({ photos: [{ _id: '64b0000000000000000000f1', publicId: 'FollMe/events/e1/a' }] }));
    eventModel.exists = jest.fn(async () => ({ _id: 'other' }));
    await service.removePhoto(EVENT, '64b0000000000000000000f1', HOST);
    await flush();
    expect(eventModel.exists).toHaveBeenCalledWith({ 'photos.publicId': 'FollMe/events/e1/a' });
    expect(cloudinary.destroy).not.toHaveBeenCalled();
  });
});

describe('checklist', () => {
  const TASK = '64b0000000000000000000d1';

  it('adds tasks at the end, within the limit, unticked', async () => {
    const { service, eventModel } = setup();
    const added: any[] = await service.addTasks(EVENT, HOST, [
      { label: ' Đặt   nhà hàng ', due: '2026-07-16T05:00:00.000Z', link: 'budget' },
      { label: '   ' },
      { label: 'Gửi thiệp', extra: 1 } as any,
    ]);
    expect(added.map(t => [t.label, t.done])).toEqual([['Đặt nhà hàng', false], ['Gửi thiệp', false]]);
    expect(added[0].due).toEqual(new Date('2026-07-16T05:00:00.000Z'));
    expect(added[1].extra).toBeUndefined();
    const [filter, update] = eventModel.updateOne.mock.calls[0];
    expect(filter).toMatchObject({ _id: EVENT, $or: [{ host: HOST }, { cohosts: HOST }] });
    expect(JSON.stringify(filter.$expr)).toContain('60');
    expect(update.$push.checklist.$each).toHaveLength(2);
  });

  it('refuses a full list, someone else\'s event and only blanks', async () => {
    const { service, eventModel } = setup();
    await expect(service.addTasks(EVENT, HOST, [{ label: ' ' }])).rejects.toBeInstanceOf(BadRequestException);
    eventModel.updateOne = jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 }));
    await expect(service.addTasks(EVENT, HOST, [{ label: 'x' }])).rejects.toBeInstanceOf(BadRequestException);
    eventModel.findOne = jest.fn(() => query(null));
    await expect(service.addTasks(EVENT, 'someone', [{ label: 'x' }])).rejects.toBeInstanceOf(NotFoundException);
  });

  it('ticks with the time, unticks, re-dates and renames', async () => {
    const { service, eventModel } = setup();
    eventModel.findOneAndUpdate = jest.fn(() => query({ checklist: [{ _id: TASK, label: 'Xếp bàn', done: true }] }));
    expect(await service.updateTask(EVENT, TASK, HOST, { done: true })).toMatchObject({ _id: TASK, done: true });
    let update = eventModel.findOneAndUpdate.mock.calls[0][1];
    expect(update.$set['checklist.$.done']).toBe(true);
    expect(update.$set['checklist.$.doneAt']).toBeInstanceOf(Date);
    await service.updateTask(EVENT, TASK, HOST, { done: false, due: null, label: ' Xếp  bàn ' });
    update = eventModel.findOneAndUpdate.mock.calls[1][1];
    expect(update.$set).toEqual({ 'checklist.$.done': false, 'checklist.$.label': 'Xếp bàn' });
    expect(update.$unset).toEqual({ 'checklist.$.doneAt': '', 'checklist.$.due': '' });
    expect(eventModel.findOneAndUpdate.mock.calls[1][0]).toMatchObject({ $or: [{ host: HOST }, { cohosts: HOST }], 'checklist._id': TASK });
  });

  it('refuses empty changes and blank labels; 404s elsewhere', async () => {
    const { service, eventModel } = setup();
    await expect(service.updateTask(EVENT, TASK, HOST, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateTask(EVENT, TASK, HOST, { label: '  ' })).rejects.toBeInstanceOf(BadRequestException);
    eventModel.findOneAndUpdate = jest.fn(() => query(null));
    await expect(service.updateTask(EVENT, TASK, 'someone', { done: true })).rejects.toBeInstanceOf(NotFoundException);
    eventModel.updateOne = jest.fn(async () => ({ matchedCount: 0, modifiedCount: 0 }));
    await expect(service.removeTask(EVENT, TASK, 'someone')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only the host view asks for it', async () => {
    const { service, eventModel } = setup();
    eventModel.findOne = jest.fn(() => query(null));
    await service.findOne(EVENT, HOST).catch(() => null);
    expect(eventModel.findOne.mock.results[0].value.select.mock.calls[0][0]).toContain('+checklist');
  });

  it('validates tasks', async () => {
    const props = async items => (await validate(plainToInstance(ChecklistDTO, { items })))
      .map(e => e.property);
    expect(await props([{ label: 'Đặt nhà hàng', due: '2026-07-16T05:00:00.000Z', link: 'seating' }])).toEqual([]);
    expect(await props([])).toEqual(['items']);
    // A page the app knows and the server not yet: the task stays, without its link
    expect(await props([{ label: 'x', link: 'nowhere' }])).toEqual([]);
    expect(tidyTask({ label: 'x', link: 'nowhere' })).toEqual({ label: 'x' });
    expect(tidyTask({ label: 'In tem', link: 'labels' })).toEqual({ label: 'In tem', link: 'labels' });
    expect(await props([{ label: 'x', link: 'x'.repeat(21) }])).toEqual(['items']);
    expect(await props([{ label: 'x'.repeat(81) }])).toEqual(['items']);
    expect(await props(Array.from({ length: 61 }, () => ({ label: 'x' })))).toEqual(['items']);
    const update = async body => (await validate(plainToInstance(UpdateTaskDTO, body))).map(e => e.property);
    expect(await update({ due: null, done: false })).toEqual([]);
    expect(await update({ done: 'yes' })).toEqual(['done']);
    expect(tidyTask({ label: ' a ' })).toEqual({ label: 'a' });
  });
});

describe('gift ledger', () => {
  it('writes what a guest gave, tidied, with the time', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { gift: { amount: 500000, note: '  kèm   thiệp ' } });
    const [filter, update] = guestModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: GUEST, event: EVENT });
    expect(update.$set.gift).toEqual({ amount: 500000, note: 'kèm thiệp', at: expect.any(Date) });
  });

  it('keeps a gift that is not money as a note', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { gift: { amount: 0, note: '1 chỉ vàng' } });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1].$set.gift).toEqual({ amount: undefined, note: '1 chỉ vàng', at: expect.any(Date) });
  });

  it('takes a guest out of the ledger with null or an empty line', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { gift: null });
    await service.updateGuest(EVENT, GUEST, HOST, { gift: { note: '  ' } });
    expect(guestModel.findOneAndUpdate.mock.calls.map(c => c[1])).toEqual([{ $unset: { gift: 1 } }, { $unset: { gift: 1 } }]);
  });

  it('only the host writes it, and the host list carries it', async () => {
    const other = setup({ event: null });
    await expect(other.service.updateGuest(EVENT, GUEST, 'someone', { gift: { amount: 1 } })).rejects.toBeInstanceOf(NotFoundException);
    expect(other.guestModel.findOneAndUpdate).not.toHaveBeenCalled();
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { gift: { amount: 1 } });
    expect(guestModel.findOneAndUpdate.mock.results[0].value.select).toHaveBeenCalledWith(expect.stringContaining('gift'));
  });

  it('adds a giver who is not on the list, with nothing to send them', async () => {
    const { service, guestModel } = setup();
    const res: any = await service.addGiftGiver(EVENT, HOST, { name: ' Cô  Sáu ', group: 'Nhà gái', gift: { amount: 1000000 } });
    expect(guestModel.create.mock.calls[0][0]).toMatchObject({ event: EVENT, name: 'Cô Sáu', group: 'Nhà gái', source: 'ledger', gift: { amount: 1000000 } });
    expect(res).toMatchObject({ name: 'Cô Sáu', source: 'ledger', gift: { amount: 1000000 } });
    await expect(service.addGiftGiver(EVENT, HOST, { name: 'Ba', gift: {} })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.addGiftGiver(EVENT, HOST, { name: '  ', gift: { amount: 1 } })).rejects.toBeInstanceOf(BadRequestException);
    const other = setup({ event: null });
    await expect(other.service.addGiftGiver(EVENT, 'someone', { name: 'Ba', gift: { amount: 1 } })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('sums the ledger; givers added later are never waited on', () => {
    const s = summarize([
      { viewed: 0, gift: { amount: 500000 } },
      { viewed: 0, source: 'ledger', gift: { amount: 1000000 } },
      { viewed: 0, source: 'ledger', gift: { note: '1 chỉ vàng' } },
      { viewed: 0 },
    ] as any);
    // The first was invited and never answered: still waited on
    expect(s).toMatchObject({ gifts: 3, giftTotal: 1500000, pending: 2 });
  });

  it('validates amounts and notes', async () => {
    const ok = await validate(plainToInstance(UpdateGuestDTO, { gift: { amount: 500000, note: 'Chuyển khoản' } }));
    expect(ok).toHaveLength(0);
    expect(await validate(plainToInstance(UpdateGuestDTO, { gift: null }))).toHaveLength(0);
    for (const gift of [{ amount: 1.5 }, { amount: -1 }, { amount: 2e10 }, { amount: '500k' }, { note: 'x'.repeat(101) }]) {
      expect(await validate(plainToInstance(UpdateGuestDTO, { gift }))).toHaveLength(1);
    }
    expect(await validate(plainToInstance(GiftGiverDTO, { name: 'Ba' }))).not.toHaveLength(0);
    expect(await validate(plainToInstance(GiftGiverDTO, { name: 'Ba', gift: { amount: 200000 } }))).toHaveLength(0);
  });
});

describe('guests', () => {
  it('renames a guest of the host\'s event', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { name: '  Cô   Ba  ' });
    expect(guestModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: GUEST, event: EVENT, isDeleted: { $ne: true } },
      { $set: { name: 'Cô Ba' } },
      { new: true },
    );
  });

  it('marks and unmarks the invitation as sent', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { sent: true });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1].$set.sentAt).toBeInstanceOf(Date);
    await service.updateGuest(EVENT, GUEST, HOST, { sent: false });
    expect(guestModel.findOneAndUpdate.mock.calls[1][1]).toEqual({ $unset: { sentAt: 1 } });
  });

  it('refuses empty updates and blank names', async () => {
    const { service, guestModel } = setup();
    await expect(service.updateGuest(EVENT, GUEST, HOST, {})).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateGuest(EVENT, GUEST, HOST, { name: '   ' })).rejects.toBeInstanceOf(BadRequestException);
    expect(guestModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('only the host can change or remove guests', async () => {
    const { service, guestModel } = setup({ event: null });
    await expect(service.updateGuest(EVENT, GUEST, 'someone', { sent: true })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.removeGuest(EVENT, GUEST, 'someone')).rejects.toBeInstanceOf(NotFoundException);
    expect(guestModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(guestModel.updateOne).not.toHaveBeenCalled();
  });

  it('404s for a guest of another event', async () => {
    const { service } = setup({ guest: null });
    await expect(service.updateGuest(EVENT, GUEST, HOST, { sent: true })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes a guest softly, to be purged later', async () => {
    const { service, guestModel } = setup();
    await service.removeGuest(EVENT, GUEST, HOST);
    const [filter, update] = guestModel.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: GUEST, event: EVENT, isDeleted: { $ne: true } });
    expect(update.$set.isDeleted).toBe(true);
    expect(update.$set.deletedAt).toBeInstanceOf(Date);
  });

  it('moves a guest into a group and out of it', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { group: '  Nhà   trai ' });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1]).toEqual({ $set: { group: 'Nhà trai' } });
    await service.updateGuest(EVENT, GUEST, HOST, { group: '  ' });
    expect(guestModel.findOneAndUpdate.mock.calls[1][1]).toEqual({ $unset: { group: 1 } });
  });

  it('marks and unmarks a thank-you', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { thanked: true });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1].$set.thankedAt).toBeInstanceOf(Date);
    await service.updateGuest(EVENT, GUEST, HOST, { thanked: false });
    expect(guestModel.findOneAndUpdate.mock.calls[1][1]).toEqual({ $unset: { thankedAt: 1 } });
    expect(await validate(plainToInstance(UpdateGuestDTO, { thanked: 'yes' }))).toHaveLength(1);
  });

  it('a guest says they sent a gift, the host ledger is left alone', async () => {
    const { service, guestModel } = setup();
    const res = await service.claimGift(GUEST, { amount: 500000, side: 'bride' });
    const [filter, update] = guestModel.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: GUEST });
    expect(update.$set.giftClaim).toMatchObject({ amount: 500000, side: 'bride' });
    expect(update.$set.gift).toBeUndefined();
    expect(res.giftClaim.at).toBeInstanceOf(Date);
    await service.claimGift(GUEST, {});
    expect(guestModel.updateOne.mock.calls[1][1].$set.giftClaim).toEqual({ at: expect.any(Date) });
    await service.withdrawGiftClaim(GUEST);
    expect(guestModel.updateOne.mock.calls[2][1]).toEqual({ $unset: { giftClaim: 1 } });
    const bad = async body => (await validate(plainToInstance(GiftClaimDTO, body))).map(e => e.property).sort();
    expect(await bad({ amount: -1, side: 'aunt' })).toEqual(['amount', 'side']);
    expect(await bad({ amount: 1.5 })).toEqual(['amount']);
    expect(await bad({})).toEqual([]);
  });

  it('marks and unmarks the message for the day', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { dayOf: true });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1].$set.dayOfAt).toBeInstanceOf(Date);
    await service.updateGuest(EVENT, GUEST, HOST, { dayOf: false });
    expect(guestModel.findOneAndUpdate.mock.calls[1][1]).toEqual({ $unset: { dayOfAt: 1 } });
    expect(await validate(plainToInstance(UpdateGuestDTO, { dayOf: 'yes' }))).toHaveLength(1);
  });

  it('marks and unmarks a reminder', async () => {
    const { service, guestModel } = setup();
    await service.updateGuest(EVENT, GUEST, HOST, { reminded: true });
    expect(guestModel.findOneAndUpdate.mock.calls[0][1].$set.remindedAt).toBeInstanceOf(Date);
    await service.updateGuest(EVENT, GUEST, HOST, { reminded: false });
    expect(guestModel.findOneAndUpdate.mock.calls[1][1]).toEqual({ $unset: { remindedAt: 1 } });
  });

  it('validates the body', async () => {
    const bad = plainToInstance(UpdateGuestDTO, { name: 'A'.repeat(101), sent: 'yes', reminded: 1, group: 'G'.repeat(41) });
    expect((await validate(bad)).map(e => e.property).sort()).toEqual(['group', 'name', 'reminded', 'sent']);
  });
});

describe('remove', () => {
  const photos = [{ _id: 'p1', publicId: 'FollMe/events/e1/a' }, { _id: 'p2', publicId: 'FollMe/events/e1/b' }];

  it('deletes the host\'s event softly and its photos for good', async () => {
    const { service, eventModel, guestModel, wishModel, cloudinary } = setup({ event: { _id: EVENT, photos } as any });
    expect(await service.remove(EVENT, HOST)).toEqual({ _id: EVENT });
    const [filter, update] = eventModel.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: EVENT, host: HOST, isDeleted: { $ne: true } });
    expect(update.$unset).toEqual({ photos: 1, screenKey: 1, deskKey: 1, cohostKey: 1 });
    const { deletedAt } = update.$set;
    expect(update.$set).toEqual({ isDeleted: true, deletedAt: expect.any(Date) });
    // Guests and wishes are purged with it
    expect(guestModel.updateMany).toHaveBeenCalledWith({ event: EVENT, deletedAt: { $exists: false } }, { $set: { deletedAt } });
    expect(wishModel.updateMany).toHaveBeenCalledWith({ event: EVENT }, { $set: { deletedAt } });
    await flush();
    expect(cloudinary.destroy.mock.calls.map(c => c[0])).toEqual(['FollMe/events/e1/a', 'FollMe/events/e1/b']);
  });

  it('404s for someone else\'s or an already deleted event', async () => {
    const { service, cloudinary, guestModel } = setup({ event: null });
    await expect(service.remove(EVENT, 'someone')).rejects.toBeInstanceOf(NotFoundException);
    expect(cloudinary.destroy).not.toHaveBeenCalled();
    expect(guestModel.updateMany).not.toHaveBeenCalled();
  });
});

describe('findPublic', () => {
  const event = (fields: any = {}) => {
    const all = { _id: EVENT, title: 'Cưới', host: HOST, ...fields };
    return { ...all, toJSON: () => ({ ...all }) };
  };

  it('counts a view and hides the host', async () => {
    const { service, eventModel } = setup({ event: event() as any });
    const res: any = await service.findPublic(EVENT);
    expect(eventModel.updateOne).toHaveBeenCalledWith({ _id: EVENT }, { $inc: { publicViews: 1 } }, { timestamps: false });
    expect(res.event).toEqual({ _id: EVENT, title: 'Cưới' });
  });

  it('does not count the host opening their own public link', async () => {
    const { service, eventModel } = setup({ event: event() as any });
    await service.findPublic(EVENT, HOST);
    expect(eventModel.updateOne).not.toHaveBeenCalled();
  });

  it('404s when the link is off or the event deleted', async () => {
    const { service, eventModel } = setup({ event: null });
    await expect(service.findPublic(EVENT)).rejects.toBeInstanceOf(NotFoundException);
    expect(eventModel.findOne).toHaveBeenCalledWith({ _id: EVENT, isDeleted: { $ne: true }, allowPublicLink: true });
    expect(eventModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('findGuest', () => {
  const doc = (fields: any) => ({ ...fields, toJSON: () => ({ ...fields }) });
  const card = (eventFields: any = {}) => doc({
    _id: GUEST, name: 'Cô Ba',
    event: doc({ _id: EVENT, title: 'Cưới', host: HOST, isDeleted: false, ...eventFields }),
  });

  it('counts a view and hides the host', async () => {
    const { service, guestModel } = setup({ guest: card() as any });
    const res: any = await service.findGuest(GUEST);
    expect(guestModel.updateOne).toHaveBeenCalledWith({ _id: GUEST }, { $inc: { viewed: 1 } });
    expect(res.name).toBe('Cô Ba');
    expect(res.event).toEqual({ _id: EVENT, title: 'Cưới' });
  });

  it('does not count the host opening their guest\'s card', async () => {
    const { service, guestModel } = setup({ guest: card() as any });
    await service.findGuest(GUEST, HOST);
    expect(guestModel.updateOne).not.toHaveBeenCalled();
    await service.findGuest(GUEST, '64b0000000000000000000ff');
    expect(guestModel.updateOne).toHaveBeenCalledTimes(1);
  });

  it('404s for a guest of a deleted event', async () => {
    const { service, guestModel } = setup({ guest: card({ isDeleted: true }) as any });
    await expect(service.findGuest(GUEST)).rejects.toBeInstanceOf(NotFoundException);
    expect(guestModel.updateOne).not.toHaveBeenCalled();
  });
});

describe('finding a seat on the shared link', () => {
  const start = new Date('2026-12-12T04:00:00Z');
  const at = (hours: number) => start.getTime() + hours * 3600_000;
  const guests = [
    { name: 'Cô Ba', table: '5' },
    { name: 'Bác Ba Thành', table: '2' },
    { name: 'Anh Đức', table: '' },
    { name: 'Chị Hà', table: 'VIP' },
  ];
  const make = () => {
    const ctx = setup({ event: { _id: EVENT, startAt: start } as any });
    ctx.guestModel.find = jest.fn(() => query(guests));
    return ctx;
  };

  it('folds accents and case', () => {
    expect(foldName('  Cô  Ba Đức! ')).toBe('co ba duc');
  });

  it('finds by the start of each word, exact name first, name and table only', async () => {
    const { service, eventModel } = make();
    const res = await service.findSeat(EVENT, 'co ba', at(1));
    expect(res).toEqual({ open: true, hasTables: true, matches: [{ name: 'Cô Ba', table: '5' }] });
    expect(eventModel.findOne.mock.calls[0][0]).toMatchObject({ _id: EVENT, allowPublicLink: true });
    expect((await service.findSeat(EVENT, 'ba', at(1))).matches.map(m => m.name)).toEqual(['Bác Ba Thành', 'Cô Ba']);
    expect((await service.findSeat(EVENT, 'duc', at(1))).matches).toEqual([{ name: 'Anh Đức', table: null }]);
  });

  it('opens 6 hours before and closes 12 hours after', async () => {
    const { service } = make();
    expect(await service.findSeat(EVENT, 'co ba', at(-7))).toEqual({ open: false, matches: [] });
    expect((await service.findSeat(EVENT, 'co ba', at(-5))).open).toBe(true);
    expect(await service.findSeat(EVENT, 'co ba', at(13))).toEqual({ open: false, matches: [] });
  });

  it('needs at least two letters; without them says whether there is a seating plan', async () => {
    const { service, guestModel } = make();
    guestModel.exists = jest.fn(async () => ({ _id: GUEST }));
    expect(await service.findSeat(EVENT, ' c ', at(1))).toEqual({ open: true, hasTables: true, matches: [] });
    expect(guestModel.exists.mock.calls[0][0]).toMatchObject({ event: EVENT, table: { $nin: [null, ''] } });
    expect(guestModel.find).not.toHaveBeenCalled();
    guestModel.exists = jest.fn(async () => null);
    expect((await service.findSeat(EVENT, '', at(1))).hasTables).toBe(false);
  });
});
