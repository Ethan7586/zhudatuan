import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

export interface OrderExpiryCheckoutPort {
  expire(database: OperationDatabase, checkout: string | null): Promise<Readonly<{ rows: readonly Readonly<{ id: string }>[] }>>;
}

export interface CheckoutRetentionPort {
  purge(database: OperationDatabase): Promise<readonly string[]>;
}

export interface CheckoutAddressSnapshotPort {
  snapshot(database: OperationDatabase, id: string | null, member: string): Promise<unknown | null>;
}
