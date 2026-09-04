export type SupportedObjectContent =
  | 'text/csv'
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/pdf'
  | 'image/png'
  | 'image/jpeg';

export function assertObjectContent(contentType: string, sample: Uint8Array): void {
  if (!contentMatches(contentType, sample)) throw new Error('UPLOAD_CONTENT_MISMATCH');
}

export function contentMatches(contentType: string, sample: Uint8Array): boolean {
  if (sample.length === 0) return false;
  switch (contentType as SupportedObjectContent) {
    case 'text/csv': return !sample.includes(0) && !knownBinary(sample);
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': return bytes(sample, [0x50, 0x4b, 0x03, 0x04]);
    case 'application/pdf': return text(sample, 5) === '%PDF-';
    case 'image/png': return bytes(sample, [0x89, 0x50, 0x4e, 0x47]);
    case 'image/jpeg': return bytes(sample, [0xff, 0xd8, 0xff]);
    default: return false;
  }
}

function knownBinary(sample: Uint8Array): boolean {
  return bytes(sample, [0x50, 0x4b, 0x03, 0x04]) || bytes(sample, [0x25, 0x50, 0x44, 0x46, 0x2d])
    || bytes(sample, [0x89, 0x50, 0x4e, 0x47]) || bytes(sample, [0xff, 0xd8, 0xff]);
}

function bytes(sample: Uint8Array, expected: readonly number[]): boolean {
  return sample.length >= expected.length && expected.every((value, index) => sample[index] === value);
}

function text(sample: Uint8Array, length: number): string {
  return new TextDecoder().decode(sample.slice(0, length));
}
