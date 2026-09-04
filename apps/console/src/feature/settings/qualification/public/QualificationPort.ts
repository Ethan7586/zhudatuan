import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { PolicyManageCommand, PolicyPreviewCommand } from '../model/Command';
import type { PolicyImpact, PolicyReceipt, QualificationDecision, QualificationPage } from '../model/Policy';
import type { EvidenceKind, QualificationCase, QualificationPublishCommand, QualificationRevokeCommand, UploadedEvidence } from '../model/Qualification';

export interface QualificationPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<QualificationPage>;
  previewPolicy(context: ConsoleContext, command: PolicyPreviewCommand, signal?: AbortSignal): Promise<PolicyImpact>;
  previewDecision(context: ConsoleContext, member: string, resource: string, signal?: AbortSignal): Promise<readonly QualificationDecision[]>;
  manage(context: ConsoleContext, command: PolicyManageCommand, signal?: AbortSignal): Promise<PolicyReceipt>;
  publish(context: ConsoleContext, command: QualificationPublishCommand, signal?: AbortSignal): Promise<QualificationCase>;
  revoke(context: ConsoleContext, command: QualificationRevokeCommand, signal?: AbortSignal): Promise<QualificationCase>;
  upload(context: ConsoleContext, file: File, kind: EvidenceKind, identity: string, signal?: AbortSignal): Promise<UploadedEvidence>;
  createIdentity(): string;
  createReference(): string;
  createQualificationReference(): string;
}
