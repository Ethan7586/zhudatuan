import type { ExperienceDocument } from '@shop/contract';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ComponentIssue } from '../../domain/value/ComponentTree';
import type { PublishEvidence } from '../../domain/value/PublishEvidence';

export interface PublishableVersion {
  readonly id: string;
  readonly application: string;
  readonly mall: string;
  readonly validation: 'pending' | 'valid' | 'invalid';
  readonly issues: readonly ComponentIssue[];
  readonly configuration: unknown;
  readonly pool: string | null;
  readonly frozenAt: string | null;
}

export interface VersionRepository {
  save(context: WriteTransactionContext, input: Readonly<{ application: string; expectedVersion: number; document: ExperienceDocument; reason: string; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
  candidate(context: WriteTransactionContext, version: string, expectedVersion?: number): Promise<PublishableVersion>;
  recordValidation(context: WriteTransactionContext, version: string, evidence: PublishEvidence): Promise<Readonly<Record<string, unknown>>>;
  freeze(context: WriteTransactionContext, version: string): Promise<void>;
  restore(context: WriteTransactionContext, input: Readonly<{ version: string; expectedVersion: number; reason: string; actor: string }>): Promise<Readonly<Record<string, unknown>>>;
}
