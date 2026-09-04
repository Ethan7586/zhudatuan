import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { KmsClient } from '../../../../foundation/application/KmsPort';
import type { ProviderInstance, ProviderInstanceValue } from '../../domain/model/ProviderInstance';
export interface ProviderSummary {
  readonly id: string;
  readonly type: ProviderInstanceValue['type'];
  readonly status: 'enabled';
}

export interface ProviderRepository {
  list(context: ReadTransactionContext, tenant?: string): Promise<readonly ProviderSummary[]>;
  require(context: ReadTransactionContext, id: string): Promise<ProviderInstance>;
  save(context: WriteTransactionContext, value: ProviderInstanceValue, expected: number, kms: KmsClient): Promise<ProviderInstance>;
}
