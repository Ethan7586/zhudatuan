const STORAGE_KEY = 'zhudatuan:miniapp:session:v1';
const COOKIE_NAME = /^__Host-[a-z0-9-]{1,64}$/;

export class CookieJar {
  private readonly values = new Map<string, string>();

  constructor() {
    const stored = record(wx.getStorageSync(STORAGE_KEY));
    for (const [name, value] of Object.entries(stored ?? {})) if (COOKIE_NAME.test(name) && validValue(value)) this.values.set(name, value);
  }

  header(): string | undefined {
    if (this.values.size === 0) return undefined;
    return [...this.values.entries()].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ');
  }

  capture(headers: Readonly<Record<string, string>>): void {
    let changed = false;
    for (const [rawName, rawValue] of Object.entries(headers)) {
      const name = rawName.toLowerCase();
      if (!['set-cookie', 'x-set-cookie', 'x-clear-cookie'].includes(name)) continue;
      for (const cookie of rawValue.split(/,(?=\s*__Host-)/)) changed = this.captureCookie(cookie) || changed;
    }
    if (changed) this.persist();
  }

  clear(): void {
    this.values.clear();
    wx.removeStorageSync(STORAGE_KEY);
  }

  private captureCookie(source: string): boolean {
    const [pair, ...attributes] = source.split(';');
    const separator = pair?.indexOf('=') ?? -1;
    if (separator < 1) return false;
    const name = pair!.slice(0, separator).trim();
    if (!COOKIE_NAME.test(name)) return false;
    const encoded = pair!.slice(separator + 1).trim();
    const expired = attributes.some((value) => /^\s*max-age\s*=\s*0\s*$/i.test(value));
    if (expired || encoded.length === 0) return this.values.delete(name);
    let value: string;
    try {
      value = decodeURIComponent(encoded);
    } catch {
      throw new Error('MINIAPP_SESSION_COOKIE_INVALID');
    }
    if (!validValue(value)) throw new Error('MINIAPP_SESSION_COOKIE_INVALID');
    this.values.set(name, value);
    return true;
  }

  private persist(): void {
    wx.setStorageSync(STORAGE_KEY, Object.freeze(Object.fromEntries(this.values)));
  }
}

function record(value: unknown): Readonly<Record<string, unknown>> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Readonly<Record<string, unknown>>) : undefined;
}

function validValue(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 16 && value.length <= 2048 && /^[A-Za-z0-9._~-]+$/.test(value);
}
