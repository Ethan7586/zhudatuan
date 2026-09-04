import {
  OP_FINANCE_SETTLEMENTS_DECIDE,
  OP_FINANCE_STATEMENTS_EXPORT,
  OP_FINANCE_WITHDRAWALS_CREATE,
  OP_FINANCE_WITHDRAWALS_DECIDE,
  OP_FINANCE_WITHDRAWALS_RECOVER,
  OP_INVOICE_REQUESTS_CANCEL,
  OP_INVOICE_REQUESTS_DECIDE,
  OP_INVOICE_REQUESTS_RED,
} from '@shop/contract/ids';
import type { OperationId, OperationInputFor } from '@shop/contract';
import { operationPolicy } from '@shop/contract/policies';
import type { FinanceRecord, FinanceSection } from './Finance';

export type FinanceActionKind =
  | 'statementexport'
  | 'settlementapprove'
  | 'settlementreject'
  | 'withdrawalcreate'
  | 'withdrawalapprove'
  | 'withdrawalreject'
  | 'withdrawalrecover'
  | 'invoicecancel'
  | 'invoiceapprove'
  | 'invoicereject'
  | 'invoicered';

export interface FinanceAction {
  readonly kind: FinanceActionKind;
  readonly label: string;
  readonly operation: OperationId;
  readonly record?: FinanceRecord;
}

export interface FinanceActionDraft {
  readonly reason: string;
  readonly proof: string;
  readonly confirmed: boolean;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly statementState: '' | 'draft' | 'final';
  readonly settlement: string;
  readonly amountMinor: string;
  readonly destinationRef: string;
}

export type FinanceCommand =
  | Readonly<{ operation: typeof OP_FINANCE_STATEMENTS_EXPORT; input: OperationInputFor<typeof OP_FINANCE_STATEMENTS_EXPORT>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_SETTLEMENTS_DECIDE; input: OperationInputFor<typeof OP_FINANCE_SETTLEMENTS_DECIDE>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_WITHDRAWALS_CREATE; input: OperationInputFor<typeof OP_FINANCE_WITHDRAWALS_CREATE>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_WITHDRAWALS_DECIDE; input: OperationInputFor<typeof OP_FINANCE_WITHDRAWALS_DECIDE>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_WITHDRAWALS_RECOVER; input: OperationInputFor<typeof OP_FINANCE_WITHDRAWALS_RECOVER>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_INVOICE_REQUESTS_CANCEL; input: OperationInputFor<typeof OP_INVOICE_REQUESTS_CANCEL>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_INVOICE_REQUESTS_DECIDE; input: OperationInputFor<typeof OP_INVOICE_REQUESTS_DECIDE>; expectedVersion?: number }>
  | Readonly<{ operation: typeof OP_INVOICE_REQUESTS_RED; input: OperationInputFor<typeof OP_INVOICE_REQUESTS_RED>; expectedVersion?: number }>;

export function emptyFinanceActionDraft(): FinanceActionDraft {
  return Object.freeze({ reason: '', proof: '', confirmed: false, periodStart: '', periodEnd: '', currency: '', statementState: '', settlement: '', amountMinor: '', destinationRef: '' });
}

export function sectionActions(section: FinanceSection, record?: FinanceRecord): readonly FinanceAction[] {
  if (record === undefined) {
    if (section === 'statements') return [action('statementexport', '导出账单', OP_FINANCE_STATEMENTS_EXPORT)];
    if (section === 'withdrawals') return [action('withdrawalcreate', '申请提现', OP_FINANCE_WITHDRAWALS_CREATE)];
    return [];
  }
  if (section === 'settlements' && record.state === 'draft') {
    return [action('settlementapprove', '批准结算', OP_FINANCE_SETTLEMENTS_DECIDE, record), action('settlementreject', '驳回结算', OP_FINANCE_SETTLEMENTS_DECIDE, record)];
  }
  if (section === 'withdrawals' && record.state === 'submitted') {
    return [action('withdrawalapprove', '批准提现', OP_FINANCE_WITHDRAWALS_DECIDE, record), action('withdrawalreject', '驳回提现', OP_FINANCE_WITHDRAWALS_DECIDE, record)];
  }
  if (section === 'withdrawals' && record.state === 'failed') return [action('withdrawalrecover', '恢复提现', OP_FINANCE_WITHDRAWALS_RECOVER, record)];
  if (section === 'invoices' && record.state === 'submitted') {
    return [
      action('invoiceapprove', '批准开票', OP_INVOICE_REQUESTS_DECIDE, record),
      action('invoicereject', '驳回开票', OP_INVOICE_REQUESTS_DECIDE, record),
      action('invoicecancel', '取消申请', OP_INVOICE_REQUESTS_CANCEL, record),
    ];
  }
  if (section === 'invoices' && record.state === 'failed') {
    return [action('invoiceapprove', '重新批准开票', OP_INVOICE_REQUESTS_DECIDE, record), action('invoicereject', '驳回开票', OP_INVOICE_REQUESTS_DECIDE, record)];
  }
  if (section === 'invoices' && record.state === 'issued' && !record.id.includes(':red:')) return [action('invoicered', '申请红冲', OP_INVOICE_REQUESTS_RED, record)];
  return [];
}

export function createFinanceCommand(actionValue: FinanceAction, draft: FinanceActionDraft): FinanceCommand {
  const reason = draft.reason.trim();
  const version = actionValue.record?.version ?? 0;
  switch (actionValue.kind) {
    case 'statementexport': {
      const body: OperationInputFor<typeof OP_FINANCE_STATEMENTS_EXPORT>['body'] = {
        ...(draft.periodStart ? { periodStart: draft.periodStart } : {}),
        ...(draft.periodEnd ? { periodEnd: draft.periodEnd } : {}),
        ...(draft.currency ? { currency: draft.currency } : {}),
        ...(draft.statementState ? { state: draft.statementState } : {}),
      };
      return { operation: OP_FINANCE_STATEMENTS_EXPORT, input: { body }, expectedVersion: 0 };
    }
    case 'settlementapprove':
    case 'settlementreject':
      return { operation: OP_FINANCE_SETTLEMENTS_DECIDE, input: { path: { settlementid: actionValue.record!.id }, body: { decision: actionValue.kind === 'settlementapprove' ? 'approved' : 'rejected', reason } }, expectedVersion: version };
    case 'withdrawalcreate':
      return { operation: OP_FINANCE_WITHDRAWALS_CREATE, input: { body: { settlement: draft.settlement.trim(), amountMinor: Number(draft.amountMinor), destinationRef: draft.destinationRef.trim(), reason } }, expectedVersion: 0 };
    case 'withdrawalapprove':
    case 'withdrawalreject':
      return { operation: OP_FINANCE_WITHDRAWALS_DECIDE, input: { path: { withdrawalid: actionValue.record!.id }, body: { decision: actionValue.kind === 'withdrawalapprove' ? 'approved' : 'rejected', reason } }, expectedVersion: version };
    case 'withdrawalrecover':
      return { operation: OP_FINANCE_WITHDRAWALS_RECOVER, input: { path: { withdrawalid: actionValue.record!.id }, body: { reason } }, expectedVersion: version };
    case 'invoicecancel':
      return { operation: OP_INVOICE_REQUESTS_CANCEL, input: { path: { requestid: actionValue.record!.id }, body: {} }, expectedVersion: version };
    case 'invoiceapprove':
    case 'invoicereject':
      return { operation: OP_INVOICE_REQUESTS_DECIDE, input: { path: { requestid: actionValue.record!.id }, body: { decision: actionValue.kind === 'invoiceapprove' ? 'approved' : 'rejected', reason } } };
    case 'invoicered':
      return { operation: OP_INVOICE_REQUESTS_RED, input: { path: { requestid: actionValue.record!.id }, body: { reason } } };
  }
}

export function validateFinanceAction(actionValue: FinanceAction | undefined, draft: FinanceActionDraft, assurance: number): string | undefined {
  if (actionValue === undefined) return '请选择要执行的操作。';
  if (actionValue.kind === 'withdrawalcreate') {
    if (!draft.settlement.trim()) return '请输入可提现结算单编号。';
    if (!Number.isSafeInteger(Number(draft.amountMinor)) || Number(draft.amountMinor) <= 0) return '请输入大于 0 的整数分金额。';
    if (!draft.destinationRef.trim()) return '请输入服务端已登记的收款目标引用。';
  }
  if (actionValue.kind !== 'statementexport' && actionValue.kind !== 'invoicecancel' && draft.reason.trim().length < 2) return '请填写至少 2 个字的业务原因。';
  const policy = operationPolicy(actionValue.operation);
  if (assurance < assuranceLevel(policy.assuranceLevel)) return '执行前需要完成二次身份验证。';
  if (policy.actionProof && !/^[A-Za-z0-9_-]{43,128}$/.test(draft.proof)) return '请输入复核人签发的一次性操作凭证。';
  if (!draft.confirmed) return '请确认目标、金额、版本和业务影响。';
  return undefined;
}

export function financeActionNeedsProof(actionValue: FinanceAction): boolean {
  return operationPolicy(actionValue.operation).actionProof;
}

export function financeActionAssurance(actionValue: FinanceAction): number {
  return assuranceLevel(operationPolicy(actionValue.operation).assuranceLevel);
}

function assuranceLevel(value: ReturnType<typeof operationPolicy>['assuranceLevel']): number {
  if (value === 'stepup') return 3;
  if (value === 'mfa') return 2;
  return value === 'session' ? 1 : 0;
}

function action(kind: FinanceActionKind, label: string, operation: OperationId, record?: FinanceRecord): FinanceAction {
  return Object.freeze({ kind, label, operation, ...(record === undefined ? {} : { record }) });
}
