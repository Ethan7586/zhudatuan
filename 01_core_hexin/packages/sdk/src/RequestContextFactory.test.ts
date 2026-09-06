import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequestContext, createSecureId } from './RequestContextFactory';

afterEach(() => vi.unstubAllGlobals());

describe('secure browser identifiers', () => {
  it('uses native randomUUID when the browser provides it', () => {
    const randomUUID = vi.fn(() => '123e4567-e89b-42d3-a456-426614174000');
    vi.stubGlobal('crypto', { randomUUID });

    expect(createSecureId()).toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('creates a UUID v4 with getRandomValues in older WeChat WebViews', () => {
    vi.stubGlobal('crypto', {
      getRandomValues(value: Uint8Array) {
        value.forEach((_, index) => { value[index] = index; });
        return value;
      },
    });

    expect(createSecureId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(createRequestContext('1.0.0').traceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('fails when no cryptographically secure browser source exists', () => {
    vi.stubGlobal('crypto', {});
    expect(() => createSecureId()).toThrow('SDK_SECURE_ID_SOURCE_UNAVAILABLE');
  });
});
