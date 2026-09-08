import type { InvoiceDownload } from '../model/Invoice';

const HASH = /^[a-f0-9]{64}$/i;
const FILENAME = /^[^/\\\u0000-\u001f\u007f]{1,255}$/;

export function verifyInvoiceDownload(value: InvoiceDownload, now = Date.now()): InvoiceDownload {
  let url: URL;
  try {
    url = new URL(value.url);
  } catch {
    throw new Error('INVOICE_DOWNLOAD_URL_INVALID');
  }
  const expiry = Date.parse(value.expiresAt);
  if (url.protocol !== 'https:' || !Number.isFinite(expiry) || expiry <= now || !FILENAME.test(value.filename) || !HASH.test(value.sha256)) {
    throw new Error('INVOICE_DOWNLOAD_RESPONSE_INVALID');
  }
  return Object.freeze({ ...value, url: url.toString() });
}

export function startInvoiceDownload(value: InvoiceDownload): void {
  const link = document.createElement('a');
  link.href = value.url;
  link.download = value.filename;
  link.rel = 'noopener noreferrer';
  link.referrerPolicy = 'no-referrer';
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.removeAttribute('href');
  link.remove();
}
