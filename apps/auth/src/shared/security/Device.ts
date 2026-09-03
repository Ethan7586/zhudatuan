const DEVICE_KEY = 'zhudatuan:identity:device:v1';
let fallback: string | undefined;

export function deviceId(): string {
  const existing = read();
  if (existing && valid(existing)) return existing;
  if (fallback && valid(fallback)) return fallback;
  const value = randomToken(32);
  fallback = value;
  write(value);
  return value;
}

export function randomToken(bytes: number): string {
  if (!Number.isInteger(bytes) || bytes < 16 || bytes > 128) throw new Error('SECURE_TOKEN_SIZE_INVALID');
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64url(value);
}

function base64url(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function valid(value: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(value);
}

function read(): string | null {
  try {
    return window.sessionStorage.getItem(DEVICE_KEY);
  } catch {
    return null;
  }
}

function write(value: string): void {
  try {
    window.sessionStorage.setItem(DEVICE_KEY, value);
  } catch {
    // A process-local identifier preserves request binding when storage is unavailable.
  }
}
