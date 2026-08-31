import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface RegistrationPolicyRecord {
  readonly id: string;
  readonly terms_title: string;
  readonly terms_body: string;
  readonly privacy_title: string;
  readonly privacy_body: string;
  readonly terms_hash: string;
}

export interface RegistrationPolicyRepository {
  current(database: OperationDatabase): Promise<RegistrationPolicyRecord | null>;
  read(database: OperationDatabase, id: string, active: boolean): Promise<RegistrationPolicyRecord | null>;
}
