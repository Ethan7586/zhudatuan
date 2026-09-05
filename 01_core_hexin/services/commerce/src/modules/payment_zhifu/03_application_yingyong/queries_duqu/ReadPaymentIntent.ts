export type PaymentResultState = 'preparing' | 'pending' | 'recovery' | 'captured' | 'failed' | 'expired';

export interface PaymentIntentSnapshot {
  readonly intentId: string;
  readonly orderId: string;
  readonly intentState: string;
  readonly expiresAt: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly paymentId: string | null;
  readonly paymentState: string | null;
  readonly attemptState: string | null;
  readonly action: unknown | null;
}

export interface PaymentIntentReadInput {
  readonly payment: string;
  readonly membership: string;
  readonly mall: string;
}

export interface PaymentIntentReader {
  read(input: PaymentIntentReadInput): Promise<PaymentIntentSnapshot | undefined>;
}

export interface PaymentIntentResult {
  readonly intentId: string;
  readonly orderId: string;
  readonly paymentId: string;
  readonly state: PaymentResultState;
  readonly paymentState: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly action: Readonly<Record<string, string>> | null;
  readonly expiresAt: string;
  readonly retryAfter: 0 | 5;
}

export class ReadPaymentIntent {
  constructor(private readonly reader: PaymentIntentReader, private readonly now: () => Date = () => new Date()) {}

  async execute(input: PaymentIntentReadInput): Promise<PaymentIntentResult> {
    const selected = await this.reader.read(input);
    if (!selected) throw new Error('PAYMENT_INTENT_NOT_FOUND');
    const expiresAt = normalizedTime(selected.expiresAt);
    const state = resultState(selected, expiresAt, this.now());
    return Object.freeze({
      intentId: selected.intentId,
      orderId: selected.orderId,
      paymentId: selected.paymentId ?? selected.intentId,
      state,
      paymentState: selected.paymentState,
      amountMinor: selected.amountMinor,
      currency: selected.currency,
      action: state === 'pending' ? paymentAction(selected.action) : null,
      expiresAt,
      retryAfter: terminalStates.has(state) ? 0 : 5,
    });
  }
}

const terminalStates: ReadonlySet<PaymentResultState> = new Set(['captured', 'failed', 'expired']);
const capturedStates: ReadonlySet<string> = new Set(['captured', 'partially_refunded', 'refunded']);

function resultState(selected: PaymentIntentSnapshot, expiresAt: string, now: Date): PaymentResultState {
  if (selected.intentState === 'captured' || (selected.paymentState && capturedStates.has(selected.paymentState))) return 'captured';
  if (selected.attemptState === 'unknown') return 'recovery';
  if (selected.intentState === 'failed' || selected.intentState === 'cancelled' || selected.attemptState === 'failed' || selected.paymentState === 'cancelled') return 'failed';
  if (selected.intentState === 'expired' || now.getTime() >= Date.parse(expiresAt)) return 'expired';
  if (selected.paymentState === 'authorized' || selected.intentState === 'authorized' || selected.attemptState === 'pending') return 'pending';
  return 'preparing';
}

function normalizedTime(value: string): string {
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) throw new Error('PAYMENT_EXPIRY_INVALID');
  return time.toISOString();
}

function paymentAction(value: unknown | null): Readonly<Record<string, string>> | null {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) return null;
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}
