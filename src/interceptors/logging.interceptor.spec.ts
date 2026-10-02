import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor.needLog', () => {
  const interceptor = new LoggingInterceptor({} as any);
  const logs = (method: string, url: string) => interceptor.needLog({ method, url });

  it('logs ordinary requests', () => {
    expect(logs('GET', '/api/events/abc')).toBe(true);
    expect(logs('GET', '/api/events/abc/screen/0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('skips uptime checks and venue screen polls', () => {
    expect(logs('GET', '/api/health')).toBe(false);
    expect(logs('GET', '/api/events/abc/screen/0123456789abcdef0123456789abcdef?since=2026-10-02T00%3A00%3A00.000Z')).toBe(false);
    expect(logs('HEAD', '/api/events')).toBe(false);
  });
});
