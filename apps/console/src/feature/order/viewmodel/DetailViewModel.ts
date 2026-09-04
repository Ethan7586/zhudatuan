import { OP_FULFILLMENT_SHIPMENTS_CREATE, OP_ORDER_ORDERS_CANCEL, OP_ORDER_ORDERS_RECEIVE, OP_ORDER_REMINDERS_CREATE, OP_PAYMENT_RECOVERIES_READ, OP_PAYMENT_RECOVERIES_RESOLVE, OP_PAYMENT_REFUNDS_REQUEST, OP_SUPPORT_CASES_READ } from '@shop/contract/ids';
import { presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { orderDetailKey, orderRecoveryKey, orderSupportKey } from './OrderQueryKey';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { orderRecoveryState } from './RecoveryViewModel';
import type { OrderRecoveryAction } from '../model/Order';

export interface OrderCommandEditor {
  readonly kind: 'cancel' | 'receive' | 'remind' | 'ship' | 'refund' | 'recovery';
  readonly reason: string;
  readonly confirmed: boolean;
  readonly tracking: string;
  readonly carrier: string;
  readonly amountMinor: string;
  readonly proof: string;
  readonly fulfillment?: import('../model/Order').OrderFulfillment;
  readonly recovery?: import('../model/Order').OrderRecovery;
  readonly recoveryAction: OrderRecoveryAction;
}

export function useOrderDetailViewModel(context: ConsoleContext, dependencies: OrderDependencies, reference?: string, requestStepup: () => void = () => undefined, refreshList: () => void = () => undefined) {
  const [copied, setCopied] = useState(false);
  const [editor, setEditor] = useState<OrderCommandEditor>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const query = useQuery({
    queryKey: orderDetailKey(context, reference ?? ''),
    queryFn: ({ signal }) => (reference === undefined ? Promise.resolve(undefined) : dependencies.readDetail.execute(context, reference, signal)),
    enabled: reference !== undefined && reference !== '',
  });
  const canReadSupport = canUseOperation(context, OP_SUPPORT_CASES_READ);
  const supportReference = query.data?.id;
  const supportQuery = useQuery({
    queryKey: orderSupportKey(context, supportReference ?? reference ?? ''),
    queryFn: ({ signal }) => dependencies.readSupport.execute(context, supportReference!, signal),
    enabled: canReadSupport && supportReference !== undefined,
  });
  const canReadRecoveries = canUseOperation(context, OP_PAYMENT_RECOVERIES_READ);
  const recoveryQuery = useQuery({
    queryKey: orderRecoveryKey(context, supportReference ?? reference ?? ''),
    queryFn: ({ signal }) => dependencies.readRecoveries.execute(context, supportReference!, signal),
    enabled: canReadRecoveries && supportReference !== undefined,
  });
  const command = useMutation<import('../model/Order').OrderCommandReceipt | import('../model/Order').OrderOperationReceipt>({
    mutationFn: () => {
      if (!query.data || !editor) throw new Error('VALIDATION_FAILED');
      if (editor.kind === 'cancel') return dependencies.cancel.execute(context, query.data, editor.reason, identity);
      if (editor.kind === 'receive') return dependencies.receive.execute(context, query.data, editor.reason, identity);
      if (editor.kind === 'remind') return dependencies.remind.execute(context, query.data, identity);
      if (editor.kind === 'ship' && editor.fulfillment) return dependencies.ship.execute(context, editor.fulfillment, editor.tracking, editor.carrier, identity);
      if (editor.kind === 'refund') return dependencies.refund.execute(context, query.data, refundMinor(editor.amountMinor), editor.reason, editor.proof, identity);
      if (editor.kind === 'recovery' && editor.recovery) return dependencies.resolveRecovery.execute(context, editor.recovery, editor.recoveryAction, editor.reason, editor.proof, identity);
      throw new Error('VALIDATION_FAILED');
    },
    onSuccess: async () => {
      await query.refetch();
      if (canReadRecoveries && supportReference !== undefined) await recoveryQuery.refetch();
      refreshList();
    },
  });
  const copyNumber = () => {
    if (query.data === undefined || navigator.clipboard === undefined) return;
    void navigator.clipboard
      .writeText(query.data.order_number)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => setCopied(false));
  };
  const condition = queryCondition({
    pending: query.isPending,
    fetching: query.isFetching,
    error: query.error,
    hasData: query.data !== undefined,
    empty: query.data === undefined && !query.isPending && query.error === null,
  });
  const queryFailure = query.error === null ? undefined : presentError(query.error);
  const support = supportState(canReadSupport, supportQuery);
  const recoveries = orderRecoveryState(canReadRecoveries, recoveryQuery);
  return Object.freeze({
    reference,
    data: query.data,
    pending: query.isPending,
    fetching: query.isFetching,
    failed: query.isError,
    error: queryFailure?.message,
    trace: queryFailure?.requestId,
    condition,
    support,
    recoveries,
    copied,
    editor,
    assurance: context.session.assurance.level,
    canCancel: canUseOperation(context, OP_ORDER_ORDERS_CANCEL) && query.data !== undefined && ['created', 'awaitingpayment'].includes(query.data.lifecycle_state) && ['unpaid', 'authorizing', 'failed'].includes(query.data.payment_state) && ['unallocated', 'allocated'].includes(query.data.fulfillment_state),
    canReceive: canUseOperation(context, OP_ORDER_ORDERS_RECEIVE) && query.data !== undefined && ['shipped', 'delivered'].includes(query.data.fulfillment_state),
    canRemind: canUseOperation(context, OP_ORDER_REMINDERS_CREATE) && query.data !== undefined && ['paid', 'fulfilling', 'shipped'].includes(query.data.lifecycle_state) && !['received', 'cancelled', 'returned'].includes(query.data.fulfillment_state),
    canShip: (target: import('../model/Order').OrderFulfillment) => canUseOperation(context, OP_FULFILLMENT_SHIPMENTS_CREATE) && ['pending', 'submitted', 'accepted', 'processing', 'ready'].includes(target.state),
    canRefund: canUseOperation(context, OP_PAYMENT_REFUNDS_REQUEST) && query.data !== undefined && query.data.payment.paymentId !== null && query.data.payment.refundableMinor > 0,
    canResolveRecovery: canUseOperation(context, OP_PAYMENT_RECOVERIES_RESOLVE),
    command: Object.freeze({ busy: command.isPending, receipt: command.data, error: safeQueryError(command.error), validation: commandValidation(editor, context.session.assurance.level, query.data) }),
    copyNumber,
    refresh: () => void query.refetch(),
    refreshSupport: () => void supportQuery.refetch(),
    refreshRecoveries: () => void recoveryQuery.refetch(),
    actions: Object.freeze({
      openCancel: () => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor(editorDefaults('cancel'));
      },
      openReceive: () => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor(editorDefaults('receive'));
      },
      openReminder: () => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor(editorDefaults('remind'));
      },
      openShip: (fulfillment: import('../model/Order').OrderFulfillment) => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor({ ...editorDefaults('ship'), fulfillment });
      },
      openRefund: () => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor({ ...editorDefaults('refund'), amountMinor: ((query.data?.payment.refundableMinor ?? 0) / 100).toFixed(2) });
      },
      openRecovery: (recovery: import('../model/Order').OrderRecovery) => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor({ ...editorDefaults('recovery'), recovery, recoveryAction: suggestedRecoveryAction(recovery.resourceType) });
      },
      closeCommand: () => {
        if (!command.isPending) setEditor(undefined);
      },
      reason: (reason: string) => setEditor((current) => (current ? { ...current, reason, confirmed: false } : current)),
      confirmed: (confirmed: boolean) => setEditor((current) => (current ? { ...current, confirmed } : current)),
      tracking: (tracking: string) => setEditor((current) => (current ? { ...current, tracking, confirmed: false } : current)),
      carrier: (carrier: string) => setEditor((current) => (current ? { ...current, carrier, confirmed: false } : current)),
      amountMinor: (amountMinor: string) => setEditor((current) => (current ? { ...current, amountMinor, confirmed: false } : current)),
      proof: (proof: string) => setEditor((current) => (current ? { ...current, proof: proof.trim(), confirmed: false } : current)),
      recoveryAction: (recoveryAction: OrderCommandEditor['recoveryAction']) => setEditor((current) => (current ? { ...current, recoveryAction, confirmed: false } : current)),
      submit: () => {
        if (commandValidation(editor, context.session.assurance.level, query.data) === undefined && !command.isPending) command.mutate();
      },
      stepup: requestStepup,
    }),
  });
}

function supportState(allowed: boolean, query: Readonly<{ isPending: boolean; isError: boolean; error: unknown; data: readonly import('../model/Order').OrderSupportCase[] | undefined }>): import('../model/Order').OrderSupportState {
  if (!allowed) return Object.freeze({ state: 'hidden' });
  if (query.isPending) return Object.freeze({ state: 'loading' });
  if (query.isError) {
    const failure = presentError(query.error);
    return Object.freeze({ state: 'unavailable', error: Object.freeze({ message: failure.message, retryable: failure.retryable, ...(failure.requestId === undefined ? {} : { traceId: failure.requestId }) }) });
  }
  return Object.freeze({ state: 'ready', data: Object.freeze([...(query.data ?? [])]) });
}

function commandValidation(editor: OrderCommandEditor | undefined, assurance: number, order?: import('../model/Order').OrderDetail): string | undefined {
  if (!editor) return undefined;
  if (editor.kind === 'cancel' && editor.reason.trim().length < 2) return '请填写取消订单的原因。';
  if (editor.kind === 'receive' && editor.reason.trim().length < 2) return '请填写确认收货的依据。';
  if (editor.kind === 'ship' && editor.tracking.trim().length < 4) return '请填写可核验的物流单号。';
  if (editor.kind === 'refund') {
    const amount = refundMinor(editor.amountMinor);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > (order?.payment.refundableMinor ?? 0)) return '退款金额必须是未退款额度内的整数分值。';
    if (editor.reason.trim().length < 2) return '请填写退款依据。';
  }
  if (editor.kind === 'recovery' && editor.reason.trim().length < 2) return '请填写支付恢复依据。';
  if ((editor.kind === 'refund' || editor.kind === 'recovery') && !/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof)) return '请粘贴另一位复核人签发的一次性操作凭证。';
  if (!editor.confirmed) return confirmationMessage(editor.kind);
  if (editor.kind === 'cancel' && assurance < 2) return '取消订单前请完成二次验证。';
  if (editor.kind === 'receive' && assurance < 2) return '确认收货前请完成二次验证。';
  if (editor.kind === 'ship' && assurance < 2) return '登记发货前请完成二次验证。';
  if ((editor.kind === 'refund' || editor.kind === 'recovery') && assurance < 3) return '提交资金动作前请完成高强度二次验证。';
  return undefined;
}

function editorDefaults(kind: OrderCommandEditor['kind']): OrderCommandEditor {
  return { kind, reason: '', confirmed: false, tracking: '', carrier: '', amountMinor: '', proof: '', recoveryAction: 'resolve' };
}

function suggestedRecoveryAction(resourceType: string): OrderCommandEditor['recoveryAction'] {
  if (resourceType === 'intent') return 'requery';
  if (resourceType === 'refund') return 'retryrefund';
  if (resourceType === 'deadletter') return 'replay';
  return 'resolve';
}

function confirmationMessage(kind: OrderCommandEditor['kind']): string {
  return ({ cancel: '请确认订单尚未支付、尚未履约，并了解取消后不可恢复。', receive: '请确认物流事实和收货状态已核对。', remind: '请确认本次催单不会重复打扰履约方。', ship: '请确认物流单号、承运方和履约对象均已核对。', refund: '请确认退款上限、原因和复核凭证均与当前订单一致。', recovery: '请确认恢复方式与错误证据一致，且不会重复执行外部动作。' } as const)[kind];
}

function refundMinor(value: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(value.trim())) return Number.NaN;
  const [yuan = '0', fraction = ''] = value.trim().split('.');
  const amount = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) ? amount : Number.NaN;
}

export type DetailViewModel = ReturnType<typeof useOrderDetailViewModel>;
