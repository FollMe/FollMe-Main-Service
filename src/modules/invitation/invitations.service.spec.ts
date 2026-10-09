import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InvitationsService, ogImage, summarize } from './invitations.service';
import { PublicRsvpDTO } from './dtos/rsvp.dto';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';
import { UpdateInvitationDTO } from './dtos/updateInvitation.dto';
import { PhotoOrderDTO } from './dtos/photo.dto';
import { UpdateGuestDTO } from './dtos/updateGuest.dto';
import { ArrivalDTO, WalkInDTO } from './dtos/desk.dto';
import { GiftGiverDTO } from './dtos/receivedGift.dto';
import { SeatingDTO } from './dtos/seating.dto';

jest.mock('src/sharedServices/mailer.service', () => ({ MailerService: class {} }));

const HOST = '64b000000000000000000001';
const EVENT = '64b0000000000000000000e1';
const GUEST = '64b0000000000000000000a1';

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
      { viewed: 2, sentAt: new Date(), rsvp: { status: 'attending', count: 2 } },
      { viewed: 1, rsvp: { status: 'attending', count: 1 } },
      { viewed: 1, rsvp: { status: 'declined', count: 0 } },
      { viewed: 0, rsvp: { status: 'maybe', count: 1 } },
      { viewed: 0 },
    ] as any);
    expect(s).toEqual({
      invited: 5, sent: 1, opened: 3, attending: 2, maybe: 1, declined: 1, pending: 1, headcount: 3, arrived: 0, arrivedPeople: 0,
      gifts: 0, giftTotal: 0,
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
    expect(filter).toMatchObject({ _id: EVENT, host: HOST, 'photos.11': { $exists: false } });
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
      expect.objectContaining({ host: HOST, 'photos._id': PHOTO_A }),
      { $pull: { photos: { _id: PHOTO_A } } },
    );
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
    expect(eventModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ host: HOST }), { $set: { screenKey: key } });
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
    expect(eventModel.updateOne.mock.calls[0][0]).toMatchObject({ host: HOST, deskKey: { $exists: false } });

    const rotated = setup({ event: { _id: EVENT, deskKey: KEY } as any });
    const { key } = await rotated.service.deskKey(EVENT, HOST, true);
    expect(key).not.toBe(KEY);
    expect(rotated.eventModel.updateOne).toHaveBeenCalledWith(expect.objectContaining({ host: HOST }), { $set: { deskKey: key } });
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
    expect(update.$unset).toEqual({ photos: 1, screenKey: 1, deskKey: 1 });
    const { deletedAt } = update.$set;
    expect(update.$set).toEqual({ isDeleted: true, deletedAt: expect.any(Date) });
    // Guests and wishes are purged with it
    expect(guestModel.updateMany).toHaveBeenCalledWith({ event: EVENT, deletedAt: { $exists: false } }, { $set: { deletedAt } });
    expect(wishModel.updateMany).toHaveBeenCalledWith({ event: EVENT }, { $set: { deletedAt } });
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
