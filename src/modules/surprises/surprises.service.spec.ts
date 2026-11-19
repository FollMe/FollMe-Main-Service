import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  SurprisesService,
  checkPassword,
  hashPassword,
  loosePassword,
  tidyGifts,
} from './surprises.service';
import { PickDTO, SurpriseDTO } from './surprise.dto';

jest.mock('src/sharedServices/mailer.service', () => ({
  MailerService: class {},
}));

const OWNER = '64b000000000000000000001';
const ID = '64b0000000000000000000e1';
const G1 = '64b0000000000000000000a1';
const G2 = '64b0000000000000000000a2';

function query(result: any) {
  const q: any = {
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const m of ['select', 'sort', 'limit']) {
    q[m] = jest.fn(() => q);
  }
  return q;
}

function setup(doc: any = null) {
  const model: any = {
    create: jest.fn(async (d) => ({ _id: ID, ...d })),
    find: jest.fn(() => query(doc ? [doc] : [])),
    findOne: jest.fn(() => query(doc)),
    findOneAndUpdate: jest.fn(() => query(doc && { pick: { title: 'x' } })),
    updateOne: jest.fn(async () => ({ matchedCount: doc ? 1 : 0 })),
  };
  const mailer: any = { sendInBackground: jest.fn() };
  return { service: new SurprisesService(model, mailer), model, mailer };
}

function surprise(extra: any = {}) {
  const { salt, hash } = hashPassword('Anh Yêu Em');
  return {
    _id: ID,
    owner: OWNER,
    ownerEmail: 'me@x.vn',
    recipientName: 'Vy',
    fromName: 'Anh Tuấn',
    message: 'Chúc em sinh nhật vui!',
    hint: 'Câu anh hay nói',
    mascot: 'bear',
    passwordSalt: salt,
    passwordHash: hash,
    gifts: [
      { _id: G1, title: 'Gấu bông', emoji: '🧸' },
      { _id: G2, title: 'Chuyến đi Đà Lạt', note: '3 ngày 2 đêm', emoji: '🏔️' },
    ],
    ...extra,
  };
}

const body = (extra: any = {}) => ({
  recipientName: '  Vy ',
  password: 'anh yeu em',
  gifts: [{ title: 'Gấu bông' }, { title: ' Váy  mới ', emoji: '👗' }],
  ...extra,
});

describe('passwords', () => {
  it('are read loosely: no case, accents or spaces', () => {
    expect(loosePassword('  Anh Yêu   Em ')).toBe('anhyeuem');
    expect(loosePassword('Đà Lạt')).toBe('dalat');
    const { salt, hash } = hashPassword('Anh Yêu Em');
    expect(checkPassword('anhyeuem', salt, hash)).toBe(true);
    expect(checkPassword('ANH YEU EM', salt, hash)).toBe(true);
    expect(checkPassword('anh yeu', salt, hash)).toBe(false);
    expect(hash).not.toContain('anhyeuem');
  });
});

describe('tidyGifts', () => {
  it('one line each, ids kept or given, empty ones out', () => {
    const out = tidyGifts([
      { _id: G1, title: '  Gấu  bông ', note: ' to ', emoji: ' 🧸 ' },
      { _id: G1, title: 'Hoa' },
      { title: ' ' },
    ]);
    expect(out.map((g) => [g.title, g.note, g.emoji])).toEqual([
      ['Gấu bông', 'to', '🧸'],
      ['Hoa', undefined, undefined],
    ]);
    expect(String(out[0]._id)).toBe(G1);
    expect(String(out[1]._id)).not.toBe(G1);
  });
});

describe('the owner', () => {
  it('creates one with a hashed password and the email to tell', async () => {
    const { service, model } = setup();
    await service.create(
      { _id: OWNER, slEmail: 'me', email: 'me@x.vn' } as any,
      body(),
    );
    const saved = model.create.mock.calls[0][0];
    expect(saved).toMatchObject({
      owner: OWNER,
      ownerEmail: 'me@x.vn',
      recipientName: 'Vy',
    });
    expect(saved.gifts.map((g) => g.title)).toEqual(['Gấu bông', 'Váy mới']);
    expect(saved.password).toBeUndefined();
    expect(
      checkPassword('Anh yêu em', saved.passwordSalt, saved.passwordHash),
    ).toBe(true);
  });

  it('needs a name, a password and two gifts', async () => {
    const { service } = setup();
    await expect(
      service.create({ _id: OWNER }, body({ recipientName: ' ' })),
    ).rejects.toThrow('tên người nhận');
    await expect(
      service.create({ _id: OWNER }, body({ password: undefined })),
    ).rejects.toThrow('mật khẩu');
    await expect(
      service.create({ _id: OWNER }, body({ password: ' a  b ' })),
    ).rejects.toThrow('ít nhất 3');
    await expect(
      service.create(
        { _id: OWNER },
        body({ gifts: [{ title: 'Hoa' }, { title: ' ' }] }),
      ),
    ).rejects.toThrow('ít nhất 2');
  });

  it('edits, keeps the password unless given, can clear the date', async () => {
    const { service, model } = setup(surprise());
    await service.update(ID, OWNER, { message: 'Mới', opensAt: null });
    const [filter, update] = model.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: ID, owner: OWNER, isDeleted: { $ne: true } });
    expect(update).toEqual({
      $set: { message: 'Mới' },
      $unset: { opensAt: 1 },
    });
    await expect(service.update(ID, OWNER, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('only sees their own', async () => {
    const { service, model } = setup(null);
    await expect(service.findForOwner(ID, OWNER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(model.findOne).toHaveBeenCalledWith({
      _id: ID,
      owner: OWNER,
      isDeleted: { $ne: true },
    });
    await expect(service.reopen(ID, OWNER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findForOwner('nope', OWNER)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets them choose again', async () => {
    const { service, model } = setup(surprise());
    await service.reopen(ID, OWNER);
    expect(model.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: ID, owner: OWNER }),
      { $unset: { pick: 1 } },
    );
  });
});

describe('the link', () => {
  it('shows only the name, the hint and the mascot before the password', async () => {
    const { service } = setup(
      surprise({ opensAt: new Date('2026-11-20T00:00:00Z') }),
    );
    const view: any = await service.publicView(
      ID,
      Date.parse('2026-11-19T12:00:00Z'),
    );
    expect(view).toEqual({
      _id: ID,
      recipientName: 'Vy',
      hint: 'Câu anh hay nói',
      mascot: 'bear',
      opensAt: expect.any(Date),
      isOpen: false,
      picked: false,
    });
    expect(view.gifts).toBeUndefined();
    expect(view.message).toBeUndefined();
  });

  it('opens with the right password, loosely', async () => {
    const { service } = setup(surprise());
    const open: any = await service.unlock(ID, { password: 'ANH YÊU EM' });
    expect(open).toMatchObject({
      recipientName: 'Vy',
      fromName: 'Anh Tuấn',
      message: 'Chúc em sinh nhật vui!',
      pick: null,
    });
    expect(open.gifts.map((g) => g.title)).toEqual([
      'Gấu bông',
      'Chuyến đi Đà Lạt',
    ]);
    expect(open.passwordHash).toBeUndefined();
  });

  it('a wrong one is counted; too many in a row means a short wait', async () => {
    const now = Date.parse('2026-11-20T10:00:00Z');
    const { service, model } = setup(surprise());
    await expect(service.unlock(ID, { password: 'sai' }, now)).rejects.toThrow(
      'Sai mật khẩu',
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: ID },
      { $set: { failedCount: 1, failedAt: new Date(now) } },
    );
    const locked = setup(
      surprise({ failedCount: 10, failedAt: new Date(now - 60e3) }),
    );
    await expect(
      locked.service.unlock(ID, { password: 'anh yeu em' }, now),
    ).rejects.toBeInstanceOf(HttpException);
    // Later it opens again, and a right password clears the count
    const later = setup(
      surprise({ failedCount: 10, failedAt: new Date(now - 11 * 60e3) }),
    );
    await later.service.unlock(ID, { password: 'anh yeu em' }, now);
    expect(later.model.updateOne).toHaveBeenCalledWith(
      { _id: ID },
      { $unset: { failedCount: 1, failedAt: 1 } },
    );
  });

  it('stays shut before its day', async () => {
    const { service } = setup(
      surprise({ opensAt: new Date('2026-11-20T00:00:00Z') }),
    );
    await expect(
      service.unlock(
        ID,
        { password: 'anh yeu em' },
        Date.parse('2026-11-19T23:00:00Z'),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('picking', () => {
  it('saves the pick once and emails the owner, escaped', async () => {
    const { service, model, mailer } = setup(
      surprise({ recipientName: 'Vy <3' }),
    );
    await service.pick(ID, {
      password: 'anh yeu em',
      giftId: G2,
      note: '  Yêu   anh ',
    });
    const [filter, update] = model.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: ID, pick: { $exists: false } });
    expect(update.$set.pick).toMatchObject({
      gift: G2,
      title: 'Chuyến đi Đà Lạt',
      emoji: '🏔️',
      note: 'Yêu anh',
    });
    const mail = mailer.sendInBackground.mock.calls[0][0];
    expect(mail.to).toBe('me@x.vn');
    expect(mail.subject).toBe('🎁 Vy <3 đã chọn quà: Chuyến đi Đà Lạt');
    expect(mail.html).toContain('Vy &lt;3');
    expect(mail.html).not.toContain('Vy <3');
  });

  it('only once, only a real gift, only with the password', async () => {
    const done = setup(surprise());
    done.model.findOneAndUpdate = jest.fn(() => query(null));
    await expect(
      done.service.pick(ID, { password: 'anh yeu em', giftId: G1 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(done.mailer.sendInBackground).not.toHaveBeenCalled();
    await expect(
      setup(surprise()).service.pick(ID, {
        password: 'anh yeu em',
        giftId: '64b0000000000000000000ff',
      }),
    ).rejects.toThrow('Không thấy');
    await expect(
      setup(surprise()).service.pick(ID, { password: 'x', giftId: G1 }),
    ).rejects.toThrow('Sai mật khẩu');
  });
});

describe('validation', () => {
  it('checks the bodies', async () => {
    const props = async (cls, b) =>
      (await validate(plainToInstance(cls, b))).map((e) => e.property).sort();
    expect(await props(SurpriseDTO, body())).toEqual([]);
    expect(
      await props(SurpriseDTO, {
        mascot: 'dragon',
        gifts: [{ title: 'x' }],
        password: 'ab',
        opensAt: 'mai',
      }),
    ).toEqual(['gifts', 'mascot', 'opensAt', 'password']);
    expect(
      await props(SurpriseDTO, {
        gifts: Array(7).fill({ title: 'x' }),
        message: 'x'.repeat(1501),
      }),
    ).toEqual(['gifts', 'message']);
    expect(await props(PickDTO, { password: 'x', giftId: 'nope' })).toEqual([
      'giftId',
    ]);
    expect(await props(PickDTO, { giftId: G1 })).toEqual(['password']);
  });
});
