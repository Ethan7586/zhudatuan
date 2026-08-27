const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_BYTES = 32;

function toBase64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function fromBase64(value: string): Uint8Array | null {
  try {
    const decoded = atob(value);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Uint8Array.from(salt).buffer, iterations }, key, PASSWORD_BYTES * 8);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derive(password, salt, PASSWORD_ITERATIONS);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${toBase64(salt)}$${toBase64(digest)}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, rawIterations, rawSalt, rawExpected, extra] = encoded.split('$');
  if (algorithm !== 'pbkdf2-sha256' || extra !== undefined) return false;
  const iterations = Number(rawIterations);
  const salt = rawSalt ? fromBase64(rawSalt) : null;
  const expected = rawExpected ? fromBase64(rawExpected) : null;
  if (!Number.isInteger(iterations) || iterations < PASSWORD_ITERATIONS || iterations > 1_000_000 || !salt || salt.length !== 16 || !expected || expected.length !== PASSWORD_BYTES) return false;
  const actual = await derive(password, salt, iterations);
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export function validRegistrationPassword(value: string): boolean {
  if (value.length < 10 || value.length > 128) return false;
  if (value !== value.trim()) return false;
  return /[A-Za-z]/.test(value) && /\d/.test(value);
}

export function normalizeChineseMobile(value: unknown): string | null {
  const mobile = typeof value === 'string' ? value.trim() : '';
  return /^1[3-9]\d{9}$/.test(mobile) ? mobile : null;
}

export function normalizeLocalUsername(value: unknown): string | null {
  const username = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[a-z][a-z0-9._-]{3,31}$/.test(username) ? username : null;
}

export function maskMobile(mobile: string): string {
  return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}

export function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 1_000_000).padStart(6, '0');
}

export function phoneLookupSubject(mobile: string, secret: string): Promise<string> {
  return sha256Text(`local_phone:${mobile}:${secret}`);
}

export function verificationCodeHash(purpose: 'registration' | 'password_reset' | 'phone_change', challengeId: string, code: string, secret: string): Promise<string> {
  return sha256Text(`${purpose}:${challengeId}:${code}:${secret}`);
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toBase64(new Uint8Array(digest));
}
