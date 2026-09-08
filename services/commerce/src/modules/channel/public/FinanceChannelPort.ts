import type { StatementFile, StatementPeriod } from '@shop/contract';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface ChannelStatement extends StatementFile {
  readonly id: string;
  readonly scope: string;
  readonly period: StatementPeriod;
}
export interface ChannelProviderAvailability {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}
export interface FinanceChannelPort {
  statement(context: ReadTransactionContext, id: string, scope: string): Promise<ChannelStatement | null>;
  importProviders(context: ReadTransactionContext, scopes: readonly string[]): Promise<readonly ChannelProviderAvailability[]>;
}
export const FINANCE_CHANNEL_PORT = publicPort<FinanceChannelPort>('channel', 'finance');
