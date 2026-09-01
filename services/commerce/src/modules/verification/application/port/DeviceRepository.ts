import type { QueryPage } from '../../../../foundation/interface/Validation';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface DeviceRepository {
  devices(context: ReadTransactionContext, scope: string, page: QueryPage): Promise<readonly Readonly<Record<string, unknown>>[]>;
  manage(
    context: WriteTransactionContext,
    input: Readonly<{ id: string; scope: string; label: string; fingerprintHash: string; publicKey: unknown; status: string; expectedVersion: number | null }>
  ): Promise<Readonly<Record<string, unknown>>>;
}
