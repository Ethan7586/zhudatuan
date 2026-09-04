import type { WechatScene } from '@shop/config/server';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface PaymentIntentContextInput {
  readonly order: string;
  readonly membership: string;
  readonly session: string;
  readonly applicationHash: string;
  readonly mall: string;
}

export interface PaymentIntentState {
  readonly intent: string;
  readonly attempt: string | null;
  readonly order_id: string;
  readonly order_number: string;
  readonly scope_id: string;
  readonly mall_id: string;
  readonly member_id: string;
  readonly total_minor: number;
  readonly amount_minor: number;
  readonly payer_identity: string | null;
  readonly payer_ciphertext: string | null;
  readonly state: string | null;
  readonly parameters: unknown | null;
  readonly scene: WechatScene | null;
  readonly application_hash: string | null;
  readonly expires_at: string;
}

export interface PaymentIntentContextReader {
  read(database: OperationDatabase, input: PaymentIntentContextInput): Promise<PaymentIntentState | undefined>;
}

export interface PaymentRecoveryInput {
  readonly membership: string;
  readonly session: string;
  readonly mall: string;
  readonly intent: string;
  readonly priority: 1 | 10;
  readonly delaySeconds: 0 | 5;
}

export interface PaymentRecoveryQueue {
  enqueue(database: OperationDatabase, input: PaymentRecoveryInput): Promise<void>;
}
