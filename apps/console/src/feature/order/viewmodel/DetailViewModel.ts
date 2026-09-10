import { OP_FULFILLMENT_SHIPMENTS_CREATE, OP_ORDER_ORDERS_CANCEL, OP_ORDER_ORDERS_RECEIVE, OP_ORDER_REMINDERS_CREATE, OP_PAYMENT_RECOVERIES_RESOLVE, OP_PAYMENT_REFUNDS_REQUEST, OP_SUPPORT_CASES_READ } from '@shop/contract/ids';
import { presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { orderDetailKey, orderRecoveryKey, orderSupportKey } from './OrderQueryKey';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { orderRecoveryAccess, orderRecoveryState } from './RecoveryViewModel';
import type { OrderCommandReceipt, OrderFulfillment, OrderOperationReceipt, OrderRecovery } from '../model/Order';
import { commandValidation, editorDefaults, orderSupportState, refundMinor, suggestedRecoveryAction, type OrderCommandEditor } from './OrderCommandEditor';

export type { OrderCommandEditor } from './OrderCommandEditor';

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
  const recoveryAccess = orderRecoveryAccess(context);
  const recoveryQuery = useQuery({
    queryKey: orderRecoveryKey(context, supportReference ?? reference ?? ''),
    queryFn: ({ signal }) => dependencies.readRecoveries.execute(context, supportReference, signal),
    enabled: recoveryAccess.ready && supportReference !== undefined,
  });
  const command = useMutation<OrderCommandReceipt | OrderOperationReceipt>({
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
      if (recoveryAccess.ready && supportReference !== undefined) await recoveryQuery.refetch();
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
  const support = orderSupportState(canReadSupport, supportQuery);
  const recoveries = orderRecoveryState(recoveryAccess, recoveryQuery);
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
    canCancel:
      canUseOperation(context, OP_ORDER_ORDERS_CANCEL) &&
      query.data !== undefined &&
      ['created', 'awaitingpayment'].includes(query.data.lifecycle_state) &&
      ['unpaid', 'authorizing', 'failed'].includes(query.data.payment_state) &&
      ['unallocated', 'allocated'].includes(query.data.fulfillment_state),
    canReceive: canUseOperation(context, OP_ORDER_ORDERS_RECEIVE) && query.data !== undefined && ['shipped', 'delivered'].includes(query.data.fulfillment_state),
    canRemind:
      canUseOperation(context, OP_ORDER_REMINDERS_CREATE) &&
      query.data !== undefined &&
      ['paid', 'fulfilling', 'shipped'].includes(query.data.lifecycle_state) &&
      !['received', 'cancelled', 'returned'].includes(query.data.fulfillment_state),
    canShip: (target: OrderFulfillment) => canUseOperation(context, OP_FULFILLMENT_SHIPMENTS_CREATE) && ['pending', 'submitted', 'accepted', 'processing', 'ready'].includes(target.state),
    canRefund: canUseOperation(context, OP_PAYMENT_REFUNDS_REQUEST) && query.data !== undefined && query.data.payment.paymentId !== null && query.data.payment.refundableMinor > 0,
    canResolveRecovery: canUseOperation(context, OP_PAYMENT_RECOVERIES_RESOLVE),
    command: Object.freeze({ busy: command.isPending, receipt: command.data, error: safeQueryError(command.error), validation: commandValidation(editor, context.session.assurance.level, query.data) }),
    copyNumber,
    refresh: () => void query.refetch(),
    refreshSupport: () => void supportQuery.refetch(),
    refreshRecoveries: () => {
      if (recoveryAccess.ready) void recoveryQuery.refetch();
    },
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
      openShip: (fulfillment: OrderFulfillment) => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor({ ...editorDefaults('ship'), fulfillment });
      },
      openRefund: () => {
        setIdentity(dependencies.createIdentity());
        command.reset();
        setEditor({ ...editorDefaults('refund'), amountMinor: ((query.data?.payment.refundableMinor ?? 0) / 100).toFixed(2) });
      },
      openRecovery: (recovery: OrderRecovery) => {
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

export type DetailViewModel = ReturnType<typeof useOrderDetailViewModel>;
