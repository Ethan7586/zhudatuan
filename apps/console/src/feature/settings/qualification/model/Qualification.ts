import type { OperationBodyFor, OperationOutputFor } from '@shop/contract';

type QualificationDto = OperationOutputFor<'qualification.center.read'>['cases'][number];
export type QualificationTargetKind = QualificationDto['applicability'][number]['kind'];
export type EvidenceKind = OperationOutputFor<'qualification.evidenceuploads.create'>['kind'];
export type EvidenceContentType = OperationBodyFor<'QualificationEvidenceuploadsCreateInput'>['contentType'];

export interface QualificationTarget {
  readonly kind: QualificationTargetKind;
  readonly id: string;
}

export interface QualificationCase {
  readonly id: string;
  readonly title: string;
  readonly subject: QualificationTarget;
  readonly state: QualificationDto['state'];
  readonly version: number;
  readonly effectiveAt: string;
  readonly expiresAt: string;
  readonly reviewedAt: string | null;
  readonly publishedAt: string | null;
  readonly revokedAt: string | null;
  readonly revokeReason: string | null;
  readonly evidenceCount: number;
  readonly applicability: readonly QualificationTarget[];
}

export interface UploadedEvidence {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly name: string;
  readonly reference: string;
  readonly sha256: string;
}

export interface QualificationPublishCommand {
  readonly id: string;
  readonly title: string;
  readonly subject: QualificationTarget;
  readonly applicability: readonly QualificationTarget[];
  readonly evidence: readonly Readonly<{ id: string; kind: EvidenceKind; reference: string; sha256: string }>[];
  readonly effectiveAt?: string;
  readonly expiresAt: string;
  readonly expectedVersion: number;
  readonly proof: string;
  readonly identity: string;
}

export interface QualificationRevokeCommand {
  readonly qualification: QualificationCase;
  readonly reason: string;
  readonly proof: string;
  readonly identity: string;
}
