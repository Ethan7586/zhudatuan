import { describe, expect, it } from 'vitest';
import { CursorCodec } from './CursorCodec';

describe('CursorCodec', () => {
  it('round trips a canonical opaque composite position', () => {
    const codec = new CursorCodec();
    const encoded = codec.encode({ sort: '2026-08-21T00:00:00.000Z', id: 'order:1' });
    expect(encoded).not.toContain('order:1');
    expect(codec.decode(encoded)).toEqual({ sort: '2026-08-21T00:00:00.000Z', id: 'order:1' });
  });

  it('rejects malformed, unsupported and non-canonical cursors', () => {
    const codec = new CursorCodec();
    expect(() => codec.decode('plain')).toThrow('CURSOR_INVALID');
    const unsupported = Buffer.from(JSON.stringify({ version: 2, sort: 'a', id: 'b' })).toString('base64url');
    expect(() => codec.decode(unsupported)).toThrow('CURSOR_VERSION_UNSUPPORTED');
  });
});
