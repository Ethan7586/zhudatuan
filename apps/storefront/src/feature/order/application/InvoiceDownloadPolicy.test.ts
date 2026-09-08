import { describe, expect, it } from 'vitest';
import { verifyInvoiceDownload } from './InvoiceDownloadPolicy';

const valid = Object.freeze({ url: 'https://files.example.test/invoice.pdf?signature=opaque', expiresAt: '2026-09-07T10:05:00.000Z', filename: '电子发票.pdf', sha256: 'a'.repeat(64) });

describe('invoice download policy', () => {
  it('accepts an unexpired HTTPS download without exposing it elsewhere', () => {
    expect(verifyInvoiceDownload(valid, Date.parse('2026-09-07T10:00:00.000Z'))).toEqual(valid);
  });

  it.each([
    [{ ...valid, url: 'http://files.example.test/invoice.pdf' }, 'HTTP'],
    [{ ...valid, expiresAt: '2026-09-07T09:59:59.000Z' }, 'expired'],
    [{ ...valid, filename: '../invoice.pdf' }, 'unsafe filename'],
    [{ ...valid, sha256: 'not-a-hash' }, 'invalid digest'],
  ])('rejects invalid response', (value, _case) => {
    expect(() => verifyInvoiceDownload(value, Date.parse('2026-09-07T10:00:00.000Z'))).toThrow();
  });
});
