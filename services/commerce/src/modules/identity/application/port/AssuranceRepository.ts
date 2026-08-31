import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface NewAssurance {
  readonly principal: string;
  readonly method: string;
  readonly level: 1 | 2 | 3;
  readonly evidenceHash: string;
  readonly expiresIn: '10minutes' | '15minutes' | '365days';
}

export interface AssuranceRepository {
  record(database: OperationDatabase, value: NewAssurance): Promise<void>;
  expire(database: OperationDatabase, principal: string, method: string): Promise<void>;
}
