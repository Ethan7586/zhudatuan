import { DomainError } from '../../../../foundation/domain/DomainError';

export type VoucherSubjectKind = 'customer' | 'member' | 'order' | 'store';
export class VoucherSubject {
  constructor(readonly kind: VoucherSubjectKind, readonly id: string) {
    if (!id || id.trim() !== id || id.length > 255 || /[\u0000-\u001f\u007f]/.test(id)) throw new DomainError('VALIDATION_FAILED', { field: 'subject' });
  }
}
