import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ProviderInstance, ProviderInstanceValue } from '../../domain/model/ProviderInstance';
export interface ProviderSummary {
  readonly id: string;
  readonly type: ProviderInstanceValue['type'];
  readonly status: ProviderInstanceValue['status'];
}

export interface ProviderRepository {
  list(database: OperationDatabase, tenant?: string): Promise<readonly ProviderSummary[]>;
  require(database: OperationDatabase, id: string): Promise<ProviderInstance>;
  save(database: OperationDatabase, value: ProviderInstanceValue, expected: number, kms: KmsClient): Promise<ProviderInstance>;
}
