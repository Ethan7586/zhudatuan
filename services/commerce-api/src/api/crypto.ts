function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function encryptJson(value: unknown, base64Key: string): Promise<string> {
  const keyBytes = base64ToBytes(base64Key);
  if (keyBytes.byteLength !== 32) {
    throw new Error('PII_ENCRYPTION_KEY must contain exactly 32 bytes');
  }

  const key = await crypto.subtle.importKey('raw', Uint8Array.from(keyBytes).buffer, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));

  return JSON.stringify({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  });
}

export async function decryptJson<T>(value: unknown, base64Key: string): Promise<T> {
  const cipher = value as { version?: number; algorithm?: string; iv?: string; ciphertext?: string };
  if (cipher.version !== 1 || cipher.algorithm !== 'AES-256-GCM' || !cipher.iv || !cipher.ciphertext) {
    throw new Error('INVALID_PII_CIPHER');
  }
  const keyBytes = base64ToBytes(base64Key);
  if (keyBytes.byteLength !== 32) throw new Error('PII_ENCRYPTION_KEY must contain exactly 32 bytes');
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(keyBytes).buffer, { name: 'AES-GCM' }, false, ['decrypt']);
  const iv = Uint8Array.from(base64ToBytes(cipher.iv)).buffer;
  const ciphertext = Uint8Array.from(base64ToBytes(cipher.ciphertext)).buffer;
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
