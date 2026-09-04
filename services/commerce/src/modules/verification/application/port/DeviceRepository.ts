import type { QueryPage } from '../../../../foundation/application/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface DeviceRepository {
  devices(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  manage(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; label: string; fingerprintHash: string; publicKey: string | null; status: 'trusted' | 'blocked' | 'retired'; expectedVersion: number | null; now: Date }>
  ): Promise<Readonly<Record<string, unknown>>>;
}
