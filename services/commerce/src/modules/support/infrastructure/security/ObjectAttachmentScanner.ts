import { createHash } from 'node:crypto';
import type { ObjectStore } from '../../../runtime/public/ObjectPort';
import type { AttachmentScanPort, AttachmentScanResult } from '../../application/port/AttachmentScanPort';
import type { PendingEvidence } from '../../application/port/SupportJobRepository';

export class ObjectAttachmentScanner implements AttachmentScanPort {
  constructor(private readonly objects: ObjectStore) {}

  async scan(item: PendingEvidence): Promise<AttachmentScanResult> {
    if (!Number.isSafeInteger(item.size) || item.size < 1 || item.size > 10 * 1024 * 1024) return rejected('SIZE_INVALID');
    if (!allowed(item.contentType)) return rejected('TYPE_INVALID');
    if (!safeName(item.originalName)) return rejected('NAME_INVALID');
    try {
      const [metadata, bytes] = await Promise.all([this.objects.inspect(item.objectReference), this.objects.read(item.objectReference, 10 * 1024 * 1024)]);
      if ((metadata as { scan: string }).scan !== 'clean') return rejected('VIRUS_DETECTED');
      if (metadata.size !== item.size || bytes.byteLength !== item.size) return rejected('SIZE_INVALID');
      if (metadata.contentType !== item.contentType || !signatureMatches(bytes, item.contentType)) return rejected('TYPE_INVALID');
      if (metadata.sha256 !== item.sha256 || createHash('sha256').update(bytes).digest('hex') !== item.sha256) return rejected('HASH_INVALID');
      if (metadata.retentionUntil === null || Date.parse(metadata.retentionUntil) <= Date.now()) return rejected('RETENTION_INVALID');
      return Object.freeze({ clean: true, reason: null, recovery: null });
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'OBJECT_MALWARE_DETECTED') return rejected('VIRUS_DETECTED');
      if (Date.parse(item.uploadExpiresAt) > Date.now()) throw cause;
      return rejected('UPLOAD_MISSING');
    }
  }
}

function rejected(reason: keyof typeof recovery): AttachmentScanResult {
  return Object.freeze({ clean: false, reason, recovery: recovery[reason] });
}

const recovery = Object.freeze({
  VIRUS_DETECTED: '附件未通过病毒检测。请删除该文件，使用可信来源的无病毒文件后重新上传。',
  TYPE_INVALID: '附件类型与文件内容不一致。请转换为 JPG、PNG、PDF 或 TXT 后重新上传。',
  SIZE_INVALID: '附件大小与上传记录不一致或超过 10 MB。请压缩到 10 MB 以内后重新上传。',
  HASH_INVALID: '附件内容校验失败。请勿修改上传中的文件，重新选择原文件上传。',
  NAME_INVALID: '附件名称不安全。请移除路径符号或控制字符，重命名后重新上传。',
  RETENTION_INVALID: '附件未设置有效保留期。请重新上传；系统会按客服证据策略自动设置保留时间。',
  UPLOAD_MISSING: '未找到完整附件或扫描服务失败。请重新上传；若仍失败，请稍后重试。',
});

function allowed(contentType: string): boolean {
  return ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'].includes(contentType);
}

function safeName(name: string): boolean {
  return (
    name ===
      name
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f/\\]/g, '')
        .trim()
        .slice(0, 255) && name.length > 0
  );
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
