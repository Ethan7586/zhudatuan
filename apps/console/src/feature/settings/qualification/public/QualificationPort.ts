import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { PolicyManageCommand, PolicyPreviewCommand } from '../model/Command';
import type { PolicyImpact, PolicyReceipt, QualificationDecision, QualificationPage } from '../model/Policy';

export interface QualificationPort {
  read(context: ConsoleContext, cursor?: string, signal?: AbortSignal): Promise<QualificationPage>;
  previewPolicy(context: ConsoleContext, command: PolicyPreviewCommand, identity: string, signal?: AbortSignal): Promise<PolicyImpact>;
  previewDecision(context: ConsoleContext, member: string, resource: string, identity: string, signal?: AbortSignal): Promise<readonly QualificationDecision[]>;
  manage(context: ConsoleContext, command: PolicyManageCommand, signal?: AbortSignal): Promise<PolicyReceipt>;
  createIdentity(): string;
  createReference(): string;
}
