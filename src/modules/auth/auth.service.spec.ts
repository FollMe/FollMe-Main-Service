import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuthService, normalizeEmail } from './auth.service';
import { SignUpDTO } from './dtos/signUp.dto';

jest.mock('src/sharedServices/mailer.service', () => ({ MailerService: class {} }));
jest.mock('src/sharedServices/cache.service', () => ({ CacheService: class {} }));

/** In-memory stand-in for the Redis calls AuthService makes. */
function fakeCache() {
  const store = new Map<string, string>();
  return {
    store,
    set: jest.fn(async (k, v) => { store.set(k, String(v)); return 'OK'; }),
    get: jest.fn(async (k) => store.get(k) ?? null),
    del: jest.fn(async (_strict, k) => (store.delete(k) ? 1 : 0)),
    setIfAbsent: jest.fn(async (k, v) => {
      if (store.has(k)) return false;
      store.set(k, String(v));
      return true;
    }),
    incr: jest.fn(async (k) => {
      const n = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(n));
      return n;
    }),
  };
}

function setup({ existing = false } = {}) {
  const cache = fakeCache();
  const userModel: any = {
    exists: jest.fn(() => ({ exec: async () => (existing ? { _id: 'u' } : null) })),
    findOne: jest.fn(() => ({ exec: async () => null })),
  };
  const userService: any = { store: jest.fn(async () => ({})) };
  const mailer: any = { sendMail: jest.fn(async () => undefined) };
  const svc = new AuthService(userModel, userService, mailer, cache as any);
  return { svc, cache, userModel, userService, mailer };
}

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Minh.Anh@Gmail.COM ')).toBe('minh.anh@gmail.com');
  });
});

describe('AuthService.generateCertifyCode', () => {
  it('sends a 6-digit code to the normalized email', async () => {
    const { svc, cache, mailer } = setup();
    await svc.generateCertifyCode(' Minh@Gmail.com');
    const code = cache.store.get('certifyCodes:minh@gmail.com');
    expect(code).toMatch(/^\d{6}$/);
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'minh@gmail.com' }));
  });

  it('refuses to resend within the cooldown', async () => {
    const { svc, mailer } = setup();
    await svc.generateCertifyCode('minh@gmail.com');
    await expect(svc.generateCertifyCode('MINH@gmail.com')).rejects.toMatchObject({ status: 429 });
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
  });

  it('refuses an email that already has an account', async () => {
    const { svc, mailer } = setup({ existing: true });
    await expect(svc.generateCertifyCode('minh@gmail.com')).rejects.toBeInstanceOf(HttpException);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });
});

describe('AuthService.signUp', () => {
  it('accepts the code as a number from the form and stores the normalized email', async () => {
    const { svc, cache, userService } = setup();
    cache.store.set('certifyCodes:minh@gmail.com', '123456');
    await svc.signUp({ email: 'Minh@gmail.com', code: 123456, password: 'secret1' });
    expect(userService.store).toHaveBeenCalledWith('minh@gmail.com', 'secret1');
    expect(cache.store.has('certifyCodes:minh@gmail.com')).toBe(false);
  });

  it('throws the code away after too many wrong guesses', async () => {
    const { svc, cache, userService } = setup();
    cache.store.set('certifyCodes:minh@gmail.com', '123456');
    for (let i = 0; i < 5; i++) {
      await expect(svc.signUp({ email: 'minh@gmail.com', code: '000000', password: 'secret1' })).rejects.toMatchObject({ status: 400 });
    }
    expect(cache.store.has('certifyCodes:minh@gmail.com')).toBe(false);
    await expect(svc.signUp({ email: 'minh@gmail.com', code: '123456', password: 'secret1' })).rejects.toMatchObject({ status: 400 });
    expect(userService.store).not.toHaveBeenCalled();
  });

  it('refuses when the email got an account after the code was sent', async () => {
    const { svc, cache, userService } = setup({ existing: true });
    cache.store.set('certifyCodes:minh@gmail.com', '123456');
    await expect(svc.signUp({ email: 'minh@gmail.com', code: '123456', password: 'secret1' })).rejects.toMatchObject({ status: 400 });
    expect(userService.store).not.toHaveBeenCalled();
  });
});

describe('SignUpDTO', () => {
  const errorsOf = async (body: object) =>
    (await validate(plainToInstance(SignUpDTO, body))).map(e => e.property);

  it('accepts a valid body', async () => {
    expect(await errorsOf({ email: 'minh@gmail.com', code: 123456, password: 'secret1' })).toEqual([]);
  });

  it('rejects a bad email, a missing code and a short password', async () => {
    expect(await errorsOf({ email: 'nope', password: '123' })).toEqual(
      expect.arrayContaining(['email', 'code', 'password']),
    );
  });
});
