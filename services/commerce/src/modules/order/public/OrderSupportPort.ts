import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface OrderSupportSummary {
  readonly id: string;
  readonly scope: string;
  readonly member: string;
  readonly number: string;
  readonly state: string;
  readonly totalMinor: number;
}

export interface OrderSupportAction {
  readonly id: string;
  readonly order: string;
  readonly aftersale: string | null;
  readonly supportCase: string;
  readonly kind: 'caseopened';
  readonly createdAt: string;
}

export interface OrderSupportPort {
  find(context: ReadTransactionContext, order: string, scopes: readonly string[], member: string, memberOnly: boolean): Promise<OrderSupportSummary | null>;
  recent(context: ReadTransactionContext, scopes: readonly string[], member: string, memberOnly: boolean, limit?: number): Promise<readonly OrderSupportSummary[]>;
  collaborate(context: WriteTransactionContext, input: Readonly<{ id: string; order: string; supportCase: string; scopes: readonly string[]; member: string; memberOnly: boolean; actor: string; trace: string }>): Promise<OrderSupportAction>;
}

export const SUPPORT_ORDER_PORT = publicPort<OrderSupportPort>('order', 'support');
