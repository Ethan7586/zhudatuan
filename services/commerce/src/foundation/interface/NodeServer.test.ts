import { describe, expect, it } from 'vitest';
import { trustedPeerAddress } from './NodeServer';

describe('trusted peer address', () => {
  it('accepts Caddy client identity only from the local reverse proxy', () => {
    expect(trustedPeerAddress('203.0.113.8', '127.0.0.1')).toBe('203.0.113.8');
    expect(trustedPeerAddress('2001:db8::8', '::1')).toBe('2001:db8::8');
    expect(trustedPeerAddress('203.0.113.9', '::ffff:127.0.0.1')).toBe('203.0.113.9');
    expect(trustedPeerAddress('203.0.113.8', '198.51.100.2')).toBe('198.51.100.2');
  });

  it('rejects malformed and ambiguous forwarded values', () => {
    expect(trustedPeerAddress('not-an-ip', '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress('203.0.113.8, 198.51.100.2', '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress(['203.0.113.8', '203.0.113.9'], '127.0.0.1')).toBe('127.0.0.1');
    expect(trustedPeerAddress(undefined, undefined)).toBe('unknown');
  });
});
