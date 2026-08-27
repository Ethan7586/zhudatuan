import { token } from '../../../../bootstrap/Container';

export interface PayoutInput {
  readonly withdrawal: string;
  readonly destination: string;
  readonly amountMinor: number;
  readonly currency: string;
}

export interface PayoutResult {
  readonly reference: string;
  readonly state: 'processing' | 'paid' | 'failed';
  readonly reason?: string;
}

export interface PayoutGateway { submit(input: PayoutInput): Promise<PayoutResult> }
export const PAYOUT_GATEWAY = token<PayoutGateway>('finance.payoutgateway');
