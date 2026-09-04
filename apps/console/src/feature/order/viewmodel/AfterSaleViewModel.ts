import { OP_FULFILLMENT_RETURNS_INSPECT, OP_FULFILLMENT_RETURNS_RECEIVE, OP_ORDER_AFTERSALES_APPROVE, OP_ORDER_AFTERSALES_REJECT } from '@shop/contract/ids';
import { safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { AfterSaleQuery } from '../model/AfterSale';
import { aftersaleKey } from './OrderQueryKey';
import type { AfterSaleRecord } from '../model/AfterSale';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import type { OrderAfterSaleDecision, OrderReturn } from '../model/Order';

export interface AfterSaleDecisionEditor {
  readonly sale: AfterSaleRecord;
  readonly decision: OrderAfterSaleDecision;
  readonly reason: string;
  readonly confirmed: boolean;
}

export interface AfterSaleReturnEditor {
  readonly sale: AfterSaleRecord;
  readonly target: OrderReturn;
  readonly kind: 'receive' | 'inspect';
  readonly tracking: string;
  readonly accepted: boolean;
  readonly note: string;
  readonly confirmed: boolean;
}

export function useAfterSaleViewModel(context: ConsoleContext, dependencies: OrderDependencies, filter: AfterSaleQuery, enabled: boolean, requestStepup: () => void = () => undefined, refreshList: () => void = () => undefined) {
  const query = useQuery({ queryKey: aftersaleKey(context, filter), queryFn: ({ signal }) => dependencies.readAftersales.execute(context, filter, signal), enabled });
  const [editor, setEditor] = useState<AfterSaleDecisionEditor>();
  const [returnEditor, setReturnEditor] = useState<AfterSaleReturnEditor>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const decision = useMutation({
    mutationFn: () => dependencies.decideAftersale.execute(context, editor!.sale, editor!.decision, editor!.reason, identity),
    onSuccess: async () => {
      await query.refetch();
      refreshList();
    },
  });
  const returnCommand = useMutation({
    mutationFn: () => {
      if (!returnEditor) throw new Error('VALIDATION_FAILED');
      return returnEditor.kind === 'receive'
        ? dependencies.receiveReturn.execute(context, returnEditor.target, returnEditor.tracking, identity)
        : dependencies.inspectReturn.execute(context, returnEditor.target, returnEditor.accepted, returnEditor.note, identity);
    },
    onSuccess: async () => {
      await query.refetch();
      refreshList();
    },
  });
  return Object.freeze({
    data: query.data,
    pending: query.isPending,
    fetching: query.isFetching,
    failed: query.isError,
    error: safeQueryError(query.error),
    editor,
    returnEditor,
    assurance: context.session.assurance.level,
    canApprove: canUseOperation(context, OP_ORDER_AFTERSALES_APPROVE),
    canReject: canUseOperation(context, OP_ORDER_AFTERSALES_REJECT),
    canReceiveReturn: canUseOperation(context, OP_FULFILLMENT_RETURNS_RECEIVE),
    canInspectReturn: canUseOperation(context, OP_FULFILLMENT_RETURNS_INSPECT),
    decision: Object.freeze({ busy: decision.isPending, receipt: decision.data, error: safeQueryError(decision.error), validation: decisionValidation(editor, context.session.assurance.level) }),
    returnCommand: Object.freeze({ busy: returnCommand.isPending, receipt: returnCommand.data, error: safeQueryError(returnCommand.error), validation: returnValidation(returnEditor, context.session.assurance.level) }),
    retry: () => void query.refetch(),
    actions: Object.freeze({
      openDecision: (sale: AfterSaleRecord, action: OrderAfterSaleDecision) => {
        setIdentity(dependencies.createIdentity());
        decision.reset();
        setEditor({ sale, decision: action, reason: '', confirmed: false });
      },
      openReturn: (sale: AfterSaleRecord, target: OrderReturn, kind: 'receive' | 'inspect') => {
        setIdentity(dependencies.createIdentity());
        returnCommand.reset();
        setReturnEditor({ sale, target, kind, tracking: '', accepted: true, note: '', confirmed: false });
      },
      closeDecision: () => {
        if (!decision.isPending) setEditor(undefined);
      },
      closeReturn: () => {
        if (!returnCommand.isPending) setReturnEditor(undefined);
      },
      reason: (reason: string) => setEditor((current) => (current ? { ...current, reason, confirmed: false } : current)),
      confirmed: (confirmed: boolean) => setEditor((current) => (current ? { ...current, confirmed } : current)),
      returnTracking: (tracking: string) => setReturnEditor((current) => (current ? { ...current, tracking, confirmed: false } : current)),
      returnAccepted: (accepted: boolean) => setReturnEditor((current) => (current ? { ...current, accepted, confirmed: false } : current)),
      returnNote: (note: string) => setReturnEditor((current) => (current ? { ...current, note, confirmed: false } : current)),
      returnConfirmed: (confirmed: boolean) => setReturnEditor((current) => (current ? { ...current, confirmed } : current)),
      submit: () => {
        if (decisionValidation(editor, context.session.assurance.level) === undefined && !decision.isPending) decision.mutate();
      },
      submitReturn: () => {
        if (returnValidation(returnEditor, context.session.assurance.level) === undefined && !returnCommand.isPending) returnCommand.mutate();
      },
      stepup: requestStepup,
    }),
  });
}

function decisionValidation(editor: AfterSaleDecisionEditor | undefined, assurance: number): string | undefined {
  if (!editor) return undefined;
  if (editor.reason.trim().length < 2) return '请填写审核依据，至少 2 个字符。';
  if (!editor.confirmed) return '请确认已核对申请行、附件、退款金额和退货要求。';
  return assurance < 3 ? '提交售后审核前请完成高强度二次验证。' : undefined;
}

function returnValidation(editor: AfterSaleReturnEditor | undefined, assurance: number): string | undefined {
  if (!editor) return undefined;
  if (editor.kind === 'inspect' && editor.note.trim().length < 2) return '请填写退货质检依据，至少 2 个字符。';
  if (!editor.confirmed) return editor.kind === 'receive' ? '请确认退货包裹和物流信息已核对。' : '请确认验收结论、商品状态和证据已核对。';
  return assurance < 2 ? '登记退货处理前请完成二次验证。' : undefined;
}

export type AfterSaleViewModel = ReturnType<typeof useAfterSaleViewModel>;
