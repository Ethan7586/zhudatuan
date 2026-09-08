import { token } from '../../../../composition/Container';

export interface PayoutInput {
  readonly withdrawal: string;
  readonly inputHash: string;
  readonly destination: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PayoutResult {
  readonly provider: string;
  readonly reference: string;
  readonly state: 'processing' | 'paid' | 'failed';
  readonly reason?: string;
}

export interface PayoutGateway {
  /** Must be idempotent for withdrawal and reject reuse with another inputHash. */
  submit(input: PayoutInput): Promise<PayoutResult>;
}
export const PAYOUT_GATEWAY = token<PayoutGateway>('finance.payoutgateway');
