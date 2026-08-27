import { describe, expect, it } from 'vitest';
import { REQUIRED_PROVIDER_IDS } from '@shop/contract';
import { BookProvider } from '../Provider';
import { manifest } from '../manifest';

describe('book provider contract', () => {
  it('is an explicit P1 provider with a release-injected signature', () => {
    expect(REQUIRED_PROVIDER_IDS).toContain('book');
    expect(BookProvider.definition.id).toBe('book');
    expect(manifest('signed').signature).toBe('signed');
    expect(() => manifest('')).toThrow('BOOK_MANIFEST_SIGNATURE_MISSING');
  });
});
