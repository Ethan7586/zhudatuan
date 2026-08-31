import { createHash } from 'node:crypto';
import { ValueObject } from '../../../../foundation/domain/ValueObject';

type ReferenceKind = 'payment' | 'refund';

export class PaymentReference extends ValueObject<Readonly<{ reference: string; kind: ReferenceKind }>> {
  private constructor(reference: string, kind: ReferenceKind) {
    super({ reference, kind });
  }

  static payment(orderNumber: string): PaymentReference {
    return new PaymentReference(reference('payment', orderNumber, 32), 'payment');
  }

  static refund(refund: string): PaymentReference {
    return new PaymentReference(reference('refund', refund, 48), 'refund');
  }

  get text(): string {
    return this.value.reference;
  }
}

function reference(kind: ReferenceKind, value: string, length: number): string {
  if (!value) throw new Error('PAYMENT_REFERENCE_SOURCE_INVALID');
  return createHash('sha256').update(`${kind}:${value}`).digest('hex').slice(0, length).toUpperCase();
}
