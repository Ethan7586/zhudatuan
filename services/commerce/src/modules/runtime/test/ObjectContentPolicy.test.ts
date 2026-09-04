import { describe, expect, it } from 'vitest';
import { assertObjectContent, contentMatches } from '../domain/policy/ObjectContentPolicy';

describe('runtime object content policy', () => {
  it.each([
    ['text/csv', new TextEncoder().encode('id,name\r\n1,测试')],
    ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14])],
    ['application/pdf', new TextEncoder().encode('%PDF-1.7')],
    ['image/png', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d])],
    ['image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])],
  ])('accepts a valid %s signature', (contentType, sample) => {
    expect(contentMatches(contentType, sample)).toBe(true);
    expect(() => assertObjectContent(contentType, sample)).not.toThrow();
  });

  it.each([
    ['empty content', 'text/csv', new Uint8Array()],
    ['binary CSV', 'text/csv', Uint8Array.from([0x61, 0x00, 0x62])],
    ['renamed archive', 'text/csv', Uint8Array.from([0x50, 0x4b, 0x03, 0x04])],
    ['renamed text', 'application/pdf', new TextEncoder().encode('hello')],
    ['unsupported content type', 'application/octet-stream', Uint8Array.from([1, 2, 3])],
  ])('rejects %s', (_name, contentType, sample) => {
    expect(contentMatches(contentType, sample)).toBe(false);
    expect(() => assertObjectContent(contentType, sample)).toThrow('UPLOAD_CONTENT_MISMATCH');
  });
});
