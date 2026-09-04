import type { PendingEvidence } from './SupportJobRepository';

export interface AttachmentScanResult {
  readonly clean: boolean;
  readonly reason: string | null;
  readonly recovery: string | null;
}

export interface AttachmentScanPort {
  scan(evidence: PendingEvidence): Promise<AttachmentScanResult>;
}
