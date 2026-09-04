import {
  OP_APPROVAL_INSTANCES_GET,
  OP_APPROVAL_TASKS_APPROVE,
  OP_APPROVAL_TASKS_REJECT,
  OP_FINANCE_RECONCILIATIONREPAIRS_DECIDE,
  OP_FINANCE_RECONCILIATIONREPAIRS_PREVIEW,
  OP_FINANCE_RECONCILIATIONREPAIRS_READ,
  OP_FINANCE_RECONCILIATIONREPAIRS_REVERSE,
  OP_FINANCE_RECONCILIATIONREPAIRS_SUBMIT,
} from '@shop/contract/ids';
import { presentError, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { ApprovalDependencies, FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { blankRepair, repairValidation, type FinanceEntryDraft, type FinanceRepair, type RepairDecision, type RepairDraft } from '../model/FinanceGovernance';
import { appendEntry, governanceKey, governanceReceipt, operationAllowed, proofValid, removeEntry, replaceEntry } from './GovernanceSupport';

export type RepairEditor =
  | Readonly<{ mode: 'create'; draft: RepairDraft; proof: string; confirmed: boolean }>
  | Readonly<{ mode: 'review'; repair: FinanceRepair; reason: string }>
  | Readonly<{ mode: 'reverse'; repair: FinanceRepair; reason: string; proof: string; confirmed: boolean }>;
type ApprovalTask = Awaited<ReturnType<ApprovalDependencies['readInstance']['execute']>>['tasks'][number];
type MutationInput =
  | Readonly<{ kind: 'submit'; draft: RepairDraft; proof: string; identity: string }>
  | Readonly<{ kind: 'decide'; repair: FinanceRepair; decision: RepairDecision; reason: string; identity: string; approvalTask: ApprovalTask }>
  | Readonly<{ kind: 'reverse'; repair: FinanceRepair; reason: string; proof: string; identity: string }>;

export function useRepairGovernance(context: ConsoleContext, finance: FinanceDependencies, approval: ApprovalDependencies, cursor: string | undefined, active: boolean, requestStepup: () => void) {
  const [editor, setEditor] = useState<RepairEditor>();
  const [identity, setIdentity] = useState(finance.createIdentity);
  const [approvalIdentity, setApprovalIdentity] = useState(approval.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const readAllowed = operationAllowed(context, OP_FINANCE_RECONCILIATIONREPAIRS_READ);
  const query = useQuery({ queryKey: governanceKey(context, OP_FINANCE_RECONCILIATIONREPAIRS_READ, cursor), queryFn: ({ signal }) => finance.readRepairs.execute(context, cursor, signal), enabled: active && readAllowed, staleTime: 30_000 });
  const preview = useMutation({ mutationFn: (input: Readonly<{ draft: RepairDraft; identity: string }>) => finance.manageRepair.preview(context, input.draft, input.identity) });
  const review = editor?.mode === 'review' ? editor.repair : undefined;
  const instanceId = review?.approvalInstanceId ?? undefined;
  const instanceAllowed = operationAllowed(context, OP_APPROVAL_INSTANCES_GET);
  const instance = useQuery({ queryKey: governanceKey(context, OP_APPROVAL_INSTANCES_GET, instanceId), queryFn: ({ signal }) => approval.readInstance.execute(context, instanceId!, signal), enabled: instanceId !== undefined && instanceAllowed });
  const manage = useMutation({
    mutationFn: async (input: MutationInput) => {
      if (input.kind === 'submit') {
        if (!preview.data) throw new Error('PREVIEW_REQUIRED');
        return finance.manageRepair.submit(context, input.draft, preview.data, input.proof, input.identity);
      }
      if (input.kind === 'reverse') return finance.manageRepair.reverse(context, input.repair, input.reason, input.proof, input.identity);
      const approvalReceipt = await approval.decide.execute(context, { kind: input.decision, task: input.approvalTask, reason: input.reason }, approvalIdentity);
      return finance.manageRepair.decide(context, input.repair, input.decision, input.reason, approvalReceipt.proof, input.identity);
    },
    onSuccess: async (result, input) => {
      const refreshed = await query.refetch();
      if (refreshed.error) throw refreshed.error;
      if (input.kind === 'submit' || input.kind === 'decide') setEditor(Object.freeze({ mode: 'review', repair: result, reason: '' }));
      else setEditor(undefined);
      preview.reset();
      if (input.kind === 'decide' && result.approvalInstanceId) await instance.refetch();
      const message = input.kind === 'submit' ? '修复建议已提交复核并完成权威回读；尚未写入账本。'
        : input.kind === 'reverse' ? '修复已追加回滚凭证并完成权威回读；历史分录保持不可变。'
        : input.decision === 'approve' ? '复核已通过，Finance 已追加冲正与替换分录并完成权威回读。'
        : '复核已驳回，账本未发生变更，审批证据已留存。';
      setReceipt(governanceReceipt(input.identity, result.id, message));
    },
  });
  const resetPreview = preview.reset;
  const resetManage = manage.reset;

  useEffect(() => {
    setEditor(undefined);
    setReceipt(undefined);
    resetPreview();
    resetManage();
  }, [context.scope.id, context.scope.kind, resetManage, resetPreview]);

  const reset = () => { setIdentity(finance.createIdentity()); setApprovalIdentity(approval.createIdentity()); preview.reset(); manage.reset(); setReceipt(undefined); };
  const update = (change: Partial<RepairDraft>) => {
    if (editor?.mode !== 'create' || preview.isPending || manage.isPending) return;
    setEditor(Object.freeze({ ...editor, draft: Object.freeze({ ...editor.draft, ...change }) }));
    reset();
  };
  const task = instance.data?.tasks.find((candidate) => candidate.state === 'pending');
  const validation = editor?.mode === 'create' ? repairValidation(editor.draft)
    ?? (preview.data === undefined ? '请先生成服务端修复预览。' : undefined)
    ?? (!proofValid(editor.proof) ? '请粘贴有效的、与本次修复提交绑定的一次性凭证。' : undefined)
    ?? (!editor.confirmed ? '请确认预览内容与业务影响。' : undefined)
    : editor?.mode === 'review' && editor.reason.trim().length < 2 ? '请填写至少 2 个字符的复核意见。'
    : editor?.mode === 'reverse' ? (editor.reason.trim().length < 2 ? '请填写至少 2 个字符的回滚原因。' : !proofValid(editor.proof) ? '请粘贴有效的回滚操作一次性凭证。' : !editor.confirmed ? '请确认将以追加凭证方式回滚。' : undefined)
    : undefined;
  const mutationError = manage.error ?? preview.error;
  return Object.freeze({
    data: query.data,
    editor,
    preview: preview.data,
    receipt,
    approval: Object.freeze({ instance: instance.data, task, condition: instanceId === undefined ? 'loading' as const : instanceAllowed ? queryCondition({ pending: instance.isPending, fetching: instance.isFetching, error: instance.error, hasData: instance.data !== undefined, empty: false }) : 'forbidden' as const, error: instanceId === undefined ? undefined : instanceAllowed ? safeQueryError(instance.error) : '当前账号没有读取本次审批详情的权限。' }),
    condition: readAllowed ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }) : 'forbidden',
    error: readAllowed ? safeQueryError(query.error) : '当前账号没有读取对账修复的权限。',
    mutationError: mutationError ? presentError(mutationError).message : undefined,
    validation,
    busy: preview.isPending || manage.isPending,
    fetching: query.isFetching,
    can: Object.freeze({
      submit: canUseOperation(context, OP_FINANCE_RECONCILIATIONREPAIRS_PREVIEW) && canUseOperation(context, OP_FINANCE_RECONCILIATIONREPAIRS_SUBMIT),
      approve: canUseOperation(context, OP_APPROVAL_TASKS_APPROVE) && canUseOperation(context, OP_FINANCE_RECONCILIATIONREPAIRS_DECIDE),
      reject: canUseOperation(context, OP_APPROVAL_TASKS_REJECT) && canUseOperation(context, OP_FINANCE_RECONCILIATIONREPAIRS_DECIDE),
      reverse: canUseOperation(context, OP_FINANCE_RECONCILIATIONREPAIRS_REVERSE),
    }),
    actions: Object.freeze({
      refresh: () => { if (readAllowed) void query.refetch(); },
      create: () => { reset(); setEditor(Object.freeze({ mode: 'create', draft: blankRepair(), proof: '', confirmed: false })); },
      review: (repair: FinanceRepair) => { reset(); setEditor(Object.freeze({ mode: 'review', repair, reason: '' })); },
      reverse: (repair: FinanceRepair) => { reset(); setEditor(Object.freeze({ mode: 'reverse', repair, reason: '', proof: '', confirmed: false })); },
      field: <TKey extends keyof RepairDraft>(key: TKey, value: RepairDraft[TKey]) => update({ [key]: value }),
      entry: (index: number, key: keyof FinanceEntryDraft, value: string | number) => editor?.mode === 'create' && update({ entries: replaceEntry(editor.draft.entries, index, key, value) }),
      addEntry: () => update({ entries: appendEntry(editor?.mode === 'create' ? editor.draft.entries : []) }),
      removeEntry: (index: number) => update({ entries: removeEntry(editor?.mode === 'create' ? editor.draft.entries : [], index) }),
      preview: () => {
        if (!operationAllowed(context, OP_FINANCE_RECONCILIATIONREPAIRS_PREVIEW)) { requestStepup(); return; }
        if (editor?.mode === 'create' && !repairValidation(editor.draft)) preview.mutate({ draft: editor.draft, identity });
      },
      proof: (proof: string) => setEditor((current) => current?.mode === 'create' || current?.mode === 'reverse' ? Object.freeze({ ...current, proof, confirmed: false }) : current),
      confirmed: (confirmed: boolean) => setEditor((current) => current?.mode === 'create' || current?.mode === 'reverse' ? Object.freeze({ ...current, confirmed }) : current),
      reason: (reason: string) => setEditor((current) => current?.mode === 'review' || current?.mode === 'reverse' ? Object.freeze({ ...current, reason }) : current),
      submit: () => {
        if (editor?.mode !== 'create' || validation || manage.isPending) return;
        if (!operationAllowed(context, OP_FINANCE_RECONCILIATIONREPAIRS_SUBMIT)) { requestStepup(); return; }
        manage.mutate({ kind: 'submit', draft: editor.draft, proof: editor.proof, identity });
      },
      decide: (decision: RepairDecision) => {
        if (editor?.mode !== 'review' || !task || validation || manage.isPending) return;
        const operation = decision === 'approve' ? OP_APPROVAL_TASKS_APPROVE : OP_APPROVAL_TASKS_REJECT;
        if (!operationAllowed(context, operation) || !operationAllowed(context, OP_FINANCE_RECONCILIATIONREPAIRS_DECIDE)) { requestStepup(); return; }
        manage.mutate({ kind: 'decide', repair: editor.repair, decision, reason: editor.reason.trim(), identity, approvalTask: task });
      },
      submitReverse: () => {
        if (editor?.mode !== 'reverse' || validation || manage.isPending) return;
        if (!operationAllowed(context, OP_FINANCE_RECONCILIATIONREPAIRS_REVERSE)) { requestStepup(); return; }
        manage.mutate({ kind: 'reverse', repair: editor.repair, reason: editor.reason.trim(), proof: editor.proof, identity });
      },
      retryApproval: () => { if (instanceAllowed) void instance.refetch(); },
      close: () => { if (!manage.isPending && !preview.isPending) { setEditor(undefined); preview.reset(); manage.reset(); } },
      dismissReceipt: () => setReceipt(undefined),
    }),
  });
}
