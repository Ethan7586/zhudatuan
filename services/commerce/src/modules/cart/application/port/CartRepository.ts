import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CartView } from '../../domain/model/Cart';
import type { CartLineMutation } from '../../domain/model/CartLine';

export interface CartRepository {
  currentView(database: OperationDatabase, member: string, mall: string, application: string): Promise<CartView | null>;
  lockOrCreate(database: OperationDatabase, member: string, mall: string, application: string, expectedVersion: number): Promise<string>;
  lockExisting(database: OperationDatabase, member: string, mall: string, application: string, expectedVersion: number): Promise<string>;
  lineVersions(database: OperationDatabase, cart: string, listings: readonly string[]): Promise<ReadonlyMap<string, number>>;
  mutate(database: OperationDatabase, cart: string, changes: readonly CartLineMutation[]): Promise<void>;
  snapshot(database: OperationDatabase, cart: string): Promise<CartView>;
}
