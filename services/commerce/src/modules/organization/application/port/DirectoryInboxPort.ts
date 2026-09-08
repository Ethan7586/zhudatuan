import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';

export interface DirectoryInboxPort {
  receive(context: WriteTransactionContext, input: Readonly<{ connection: string; eventid: string; version: number; bodyhash: string; payload: string }>): Promise<'accepted' | 'duplicate' | 'stale'>;
}
