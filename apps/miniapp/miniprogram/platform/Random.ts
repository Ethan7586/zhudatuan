const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export async function randomToken(length: number): Promise<string> {
  if (!Number.isInteger(length) || length < 16 || length > 128) throw new Error('MINIAPP_RANDOM_LENGTH_INVALID');
  const bytes = await randomBytes(length);
  let value = '';
  let index = 0;
  while (index < bytes.length) {
    const first = bytes[index++]!;
    const second = index < bytes.length ? bytes[index++]! : undefined;
    const third = index < bytes.length ? bytes[index++]! : undefined;
    value += alphabet[first >> 2]!;
    value += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)]!;
    if (second !== undefined) value += alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)]!;
    if (third !== undefined) value += alphabet[third & 63]!;
  }
  return value;
}

export function randomBytes(length: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    wx.getRandomValues({
      length,
      success: ({ randomValues }) => resolve(new Uint8Array(randomValues)),
      fail: reject,
    });
  });
}
