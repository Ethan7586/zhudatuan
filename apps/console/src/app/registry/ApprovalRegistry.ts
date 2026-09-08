import { APPROVAL_SUBJECT_KINDS } from '@shop/contract';
import { createRegistry, type RegistryPort } from './Registry';

export type ApprovalSubject = (typeof APPROVAL_SUBJECT_KINDS)[number];

export interface ApprovalRegistration {
  readonly id: ApprovalSubject;
  readonly label: string;
}

export type ApprovalRegistryPort = RegistryPort<ApprovalSubject, ApprovalRegistration>;

const LABELS: Readonly<Record<ApprovalSubject, string>> = Object.freeze({
  voucherstock: '卡券库存',
  voucherissue: '卡券发放',
  financerepair: '财务修复',
  reconciliation: '对账差异',
  withdrawal: '提现',
  refund: '退款',
  experiencepublish: '商城发布',
  riskexception: '风险例外',
  riskaction: '风险动作',
  inventoryadjustment: '库存调整',
});

export function createApprovalRegistry(): ApprovalRegistryPort {
  return createRegistry(
    APPROVAL_SUBJECT_KINDS.map((id) => Object.freeze({ id, label: LABELS[id] })),
    APPROVAL_SUBJECT_KINDS,
    'APPROVAL'
  );
}
