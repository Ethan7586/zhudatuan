import type { CipherEnvelope } from '../../../../pipeline/KmsPort';
import type { QueryPage } from '../../../../pipeline/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { ChannelEntitlement } from '../../../capability/public';
import type { BindingState } from '../../domain/model/Distributor';

export interface DistributorRepository {
  create(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; code: string; name: string; timezone: string; settlementMode: string; metadata: Readonly<Record<string, unknown>>; contact: CipherEnvelope | null }>
  ): Promise<Readonly<Record<string, unknown>>>;
  read(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  update(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      scope: string;
      name: string | null;
      settlementMode: string | null;
      metadata: Readonly<Record<string, unknown>> | null;
      contactChanged: boolean;
      contact: CipherEnvelope | null;
      expectedVersion: number | null;
    }>
  ): Promise<Readonly<Record<string, unknown>>>;
  disable(context: WriteTransactionContext, id: string, scope: string, expectedVersion: number | null): Promise<Readonly<Record<string, unknown>>>;
  manageBinding(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; root: string; distributor: string; tenant: string; state: BindingState; evidence: Readonly<Record<string, unknown>>; effectiveAt: unknown; expiresAt: unknown; expectedVersion: number | null }>
  ): Promise<Readonly<Record<string, unknown>>>;
  manageQuota(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; capability: string; state: 'enabled' | 'disabled'; quota: number | null; expiresAt: unknown; expectedVersion: number | null }>
  ): Promise<ChannelEntitlement>;
}
