import { createHash } from 'node:crypto';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { AttachmentScanPort, AttachmentScanResult } from '../../application/port/AttachmentScanPort';
import type { PendingEvidence } from '../../application/port/SupportJobRepository';

export class ObjectAttachmentScanner implements AttachmentScanPort {
  constructor(private readonly objects: ObjectStore) {}

  async scan(item: PendingEvidence): Promise<AttachmentScanResult> {
    try {
      const [metadata, bytes] = await Promise.all([
        this.objects.inspect(item.objectReference),
        this.objects.read(item.objectReference, 10 * 1024 * 1024),
      ]);
      const clean = metadata.scan === 'clean' &&
        metadata.sha256 === item.sha256 &&
        createHash('sha256').update(bytes).digest('hex') === item.sha256 &&
        metadata.size === item.size &&
        bytes.byteLength === item.size &&
        metadata.contentType === item.contentType &&
        allowed(item.contentType) &&
        signatureMatches(bytes, item.contentType) &&
        safeName(item.originalName);
      return Object.freeze({ clean, reason: clean ? null : 'CONTENT_VALIDATION_FAILED' });
    } catch (cause) {
      if (Date.parse(item.uploadExpiresAt) > Date.now()) throw cause;
      return Object.freeze({ clean: false, reason: 'UPLOAD_MISSING_OR_SCAN_FAILED' });
    }
  }
}

function allowed(contentType: string): boolean {
  return ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'].includes(contentType);
}

function safeName(name: string): boolean {
  return name === name.normalize('NFKC').replace(/[\u0000-\u001f\u007f/\\]/g, '').trim().slice(0, 255) && name.length > 0;
}

function signatureMatches(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (contentType === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (contentType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  try {
    return !bytes.includes(0) && new TextDecoder('utf-8', { fatal: true }).decode(bytes).length > 0;
  } catch {
    return false;
  }
}
