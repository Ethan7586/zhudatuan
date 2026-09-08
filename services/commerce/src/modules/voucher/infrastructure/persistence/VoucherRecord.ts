import { randomUUID } from 'node:crypto';
import type { OperationOutputFor } from '@shop/contract';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import { VOUCHER_TERMS } from './IssueTerms';
import type { MemberAccessPort } from '../../../access/public';
import type { VoucherAccountingPort } from '../../../finance/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { ActivationLookup, ActivationRate } from '../../application/port/ActivationRate';
import { OperationRejection } from '../../../../pipeline/OperationRejection';
import type { OperationReply } from '../../../../pipeline/OperationHandler';
import type { VoucherRepository } from '../../application/port/VoucherRepository';
import { Voucher } from '../../domain/model/Voucher';
import { Holder, type HolderValue } from '../../domain/model/Holder';
import { body, cursor, expected, limit, normalize, one, page, path, REDEMPTION, requiredIdempotency, text, VOUCHER, VOUCHER_FIELDS, write } from './VoucherSupport';
import { VoucherRefundWriter } from './VoucherRefundWriter';
import { timeline, VoucherRedemptionWriter } from './VoucherRedemptionWriter';

export interface VoucherRow {
  readonly id: string;
  readonly credential_id: string;
  readonly product_id: string;
  readonly holder_id: string | null;
  readonly initial_minor: number;
  readonly remaining_minor: number;
  readonly currency: string;
  readonly state: 'generated' | 'available' | 'allocated' | 'bound' | 'active' | 'held' | 'redeemed' | 'disabled' | 'void' | 'reversed' | 'expired';
  readonly starts_at: Date;
  readonly expires_at: Date;
  readonly version: number;
}
export function aggregate(row: VoucherRow) {
  return new Voucher({
    id: row.id,
    credential: row.credential_id,
    product: row.product_id,
    holder: row.holder_id,
    initialMinor: Number(row.initial_minor),
    remainingMinor: Number(row.remaining_minor),
    state: row.state,
    startsAt: new Date(row.starts_at),
    expiresAt: new Date(row.expires_at),
    version: Number(row.version),
  });
}
export async function lock(database: ReturnType<PgTransactionAccess['database']>, id: string, scope: string): Promise<VoucherRow> {
  const row = (await database.query<VoucherRow>(`select ${VOUCHER_FIELDS} from voucher.voucher voucher where voucher.id=$1 and voucher.scope_id=$2 for update`, [id, scope])).rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return row;
}
export function ownOnly(target: string) {
  return target === 'storefront' || target === 'miniapp';
}
export function activationFailure(code: 'RATE_LIMITED' | 'VOUCHER_SECRET_INVALID'): OperationReply<OperationOutputFor<'voucher.activations.secret'>> {
  return new OperationRejection(code).result as unknown as OperationReply<OperationOutputFor<'voucher.activations.secret'>>;
}
