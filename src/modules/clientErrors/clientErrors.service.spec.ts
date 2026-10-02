import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientErrorsService } from './clientErrors.service';
import { ClientErrorDTO } from './clientError.dto';

describe('ClientErrorsService', () => {
  it('stores the error with the path only and a short user agent', async () => {
    const model: any = { create: jest.fn(async doc => doc) };
    const service = new ClientErrorsService(model);
    await service.record(
      { message: '  TypeError: x is undefined ', stack: 'at f (main.js:1:2)', path: 'https://follme.vn/invitations/abc?ref=zalo#loi-chuc' },
      'Mozilla/5.0 '.repeat(50),
    );
    const doc = model.create.mock.calls[0][0];
    expect(doc.message).toBe('TypeError: x is undefined');
    expect(doc.path).toBe('/invitations/abc');
    expect(doc.stack).toBe('at f (main.js:1:2)');
    expect(doc.userAgent).toHaveLength(300);
  });

  it('validates the report', async () => {
    const bad = plainToInstance(ClientErrorDTO, { message: '', stack: 'x'.repeat(4001), path: 3 });
    expect((await validate(bad)).map(e => e.property).sort()).toEqual(['message', 'path', 'stack']);
    const ok = plainToInstance(ClientErrorDTO, { message: 'boom' });
    expect(await validate(ok)).toEqual([]);
  });
});
