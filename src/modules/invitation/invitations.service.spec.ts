import { BadRequestException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InvitationsService, summarize } from './invitations.service';
import { PublicRsvpDTO } from './dtos/rsvp.dto';
import { CreateInvitationDTO } from './dtos/createInvitation.dto';

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
  const guestModel: any = {
    findOne: jest.fn(() => query(guest)),
    updateOne: jest.fn(async () => ({ matchedCount: 1 })),
    create: jest.fn(async (doc) => ({ _id: 'new-guest', ...doc })),
    insertMany: jest.fn(async (docs) => docs.map((d, i) => ({ _id: `g${i}`, ...d }))),
  };
  const wishModel: any = {
    create: jest.fn(async (doc) => ({ _id: 'w1', createdAt: new Date(), ...doc })),
    find: jest.fn(() => query([])),
    updateOne: jest.fn(async () => ({ matchedCount: 1 })),
  };
  const session = { startTransaction: jest.fn(), commitTransaction: jest.fn(), abortTransaction: jest.fn(), endSession: jest.fn() };
  const connection: any = { startSession: jest.fn(async () => session) };
  const mailer: any = { sendInBackground: jest.fn() };
  const service = new InvitationsService(eventModel, guestModel, wishModel, connection, mailer);
  return { service, eventModel, guestModel, wishModel, mailer, saved };
}

describe('createOne', () => {
  it('stores only editable fields and the host', async () => {
    const { service, saved, mailer } = setup();
    const body: any = {
      title: ' Lễ cưới Minh & Lan ', location: 'Hà Nội', startAt: '2027-01-10T10:00:00.000Z',
      type: 'wedding', theme: 'blush', groomName: 'Minh', brideName: 'Lan', allowPublicLink: true,
      host: 'attacker', publicViews: 999, isDeleted: true,
      guests: [{ name: 'An', email: 'an@example.com' }, { name: 'Bình' }],
    };
    await service.createOne(body, HOST, 'host@example.com');
    expect(saved[0]).toEqual({
      title: 'Lễ cưới Minh & Lan', location: 'Hà Nội', startAt: '2027-01-10T10:00:00.000Z',
      type: 'wedding', theme: 'blush', groomName: 'Minh', brideName: 'Lan', allowPublicLink: true,
      host: HOST,
    });
    expect(mailer.sendInBackground).toHaveBeenCalledTimes(1);
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
      { viewed: 2, rsvp: { status: 'attending', count: 2 } },
      { viewed: 1, rsvp: { status: 'attending', count: 1 } },
      { viewed: 1, rsvp: { status: 'declined', count: 0 } },
      { viewed: 0, rsvp: { status: 'maybe', count: 1 } },
      { viewed: 0 },
    ] as any);
    expect(s).toEqual({ invited: 5, opened: 3, attending: 2, maybe: 1, declined: 1, pending: 1, headcount: 3 });
  });
});

describe('CreateInvitationDTO', () => {
  it('caps the guest list and guest names', async () => {
    const base = { title: 'T', location: 'L', startAt: '2027-01-01T00:00:00Z' };
    const many = plainToInstance(CreateInvitationDTO, { ...base, guests: Array.from({ length: 501 }, () => ({ name: 'A' })) });
    expect((await validate(many)).map(e => e.property)).toEqual(['guests']);
    const longName = plainToInstance(CreateInvitationDTO, { ...base, guests: [{ name: 'A'.repeat(101) }] });
    expect((await validate(longName)).map(e => e.property)).toEqual(['guests']);
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
