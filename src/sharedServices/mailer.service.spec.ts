import { MailerService } from './mailer.service';

describe('MailerService.sendInBackground', () => {
  it('logs a failed send instead of leaving an unhandled rejection', async () => {
    const svc = new MailerService();
    (svc as any).transporter = { sendMail: jest.fn(async () => { throw new Error('SMTP down'); }) };
    const logged = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      expect(() => svc.sendInBackground({ to: 'a@b.c' })).not.toThrow();
      await new Promise(resolve => setImmediate(resolve));
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('SMTP down'));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
