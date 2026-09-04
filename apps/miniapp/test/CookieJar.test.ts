import { beforeEach, describe, expect, it } from 'vitest';
import { CookieJar } from '../miniprogram/platform/CookieJar';

const storage = new Map<string, unknown>();

beforeEach(() => {
  storage.clear();
  Object.assign(globalThis, {
    wx: {
      getStorageSync: (key: string) => storage.get(key),
      setStorageSync: (key: string, value: unknown) => storage.set(key, value),
      removeStorageSync: (key: string) => storage.delete(key),
    },
  });
});

describe('miniapp cookie jar', () => {
  it('captures only host cookies and removes expired values', () => {
    const jar = new CookieJar();
    jar.capture({
      'Set-Cookie': '__Host-miniapp-session=abcdefghijklmnopqrstuvwxyzABCDEFG; Path=/; Secure; HttpOnly; SameSite=Strict',
      'x-set-cookie': '__Host-miniapp-csrf=abcdefghijklmnopqrstuvwxyzHIJKLMN; Path=/; Secure; SameSite=Strict',
      ignored: 'value',
    });
    expect(jar.header()).toContain('__Host-miniapp-session=');
    expect(jar.header()).toContain('__Host-miniapp-csrf=');

    jar.capture({ 'x-clear-cookie': '__Host-miniapp-session=; Path=/; Max-Age=0; Secure' });
    expect(jar.header()).not.toContain('__Host-miniapp-session=');
  });

  it('does not restore malformed persisted values', () => {
    storage.set('zhudatuan:miniapp:session:v1', { unsafe: 'secret', '__Host-miniapp-session': 'short' });
    expect(new CookieJar().header()).toBeUndefined();
  });
});
