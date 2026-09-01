import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export interface DirectoryInboxPort {
  receive(context: WriteTransactionContext, input: Readonly<{ connection: string; eventid: string; version: number; bodyhash: string; payload: string }>): Promise<'accepted' | 'duplicate' | 'stale'>;
}
