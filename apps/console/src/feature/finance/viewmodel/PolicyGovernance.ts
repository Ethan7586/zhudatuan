import { OP_FINANCE_POLICIES_MANAGE, OP_FINANCE_POLICIES_PREVIEW, OP_FINANCE_POLICIES_READ } from '@shop/contract/ids';
import { presentError, queryCondition, safeQueryError, type Receipt } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { blankPolicy, editPolicy, policyValidation, type FinanceEntryDraft, type FinancePolicy, type PolicyDraft } from '../model/FinanceGovernance';
import { appendEntry, governanceKey, governanceReceipt, operationAllowed, proofValid, removeEntry, replaceEntry } from './GovernanceSupport';

export interface PolicyEditor {
  readonly mode: 'create' | 'edit' | 'retire';
  readonly draft: PolicyDraft;
  readonly proof: string;
  readonly confirmed: boolean;
}

export function usePolicyGovernance(context: ConsoleContext, finance: FinanceDependencies, cursor: string | undefined, active: boolean, requestStepup: () => void) {
  const [editor, setEditor] = useState<PolicyEditor>();
  const [identity, setIdentity] = useState(finance.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const readAllowed = operationAllowed(context, OP_FINANCE_POLICIES_READ);
  const query = useQuery({ queryKey: governanceKey(context, OP_FINANCE_POLICIES_READ, cursor), queryFn: ({ signal }) => finance.readPolicies.execute(context, cursor, signal), enabled: active && readAllowed, staleTime: 30_000 });
  const preview = useMutation({ mutationFn: (input: Readonly<{ draft: PolicyDraft; identity: string }>) => finance.previewPolicy.execute(context, input.draft, input.identity) });
  const manage = useMutation({
    mutationFn: async (input: Readonly<{ editor: PolicyEditor; identity: string }>) => {
      if (!preview.data) throw new Error('PREVIEW_REQUIRED');
      return finance.managePolicy.execute(context, input.editor.draft, preview.data, input.editor.proof, input.identity);
    },
    onSuccess: async (result, input) => {
      const refreshed = await query.refetch();
      if (refreshed.error) throw refreshed.error;
      setEditor(undefined);
      preview.reset();
      setReceipt(governanceReceipt(input.identity, result.reference, `财务政策已按服务端预览执行并权威回读，当前状态：${result.state}，版本：${result.version}。`));
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

  const reset = () => { setIdentity(finance.createIdentity()); preview.reset(); manage.reset(); setReceipt(undefined); };
  const update = (change: Partial<PolicyDraft>) => {
    if (preview.isPending || manage.isPending) return;
    setEditor((current) => current && Object.freeze({ ...current, draft: Object.freeze({ ...current.draft, ...change }) }));
    reset();
  };
  const validation = editor ? policyValidation(editor.draft)
    ?? (preview.data === undefined ? '请先生成服务端影响预览。' : undefined)
    ?? (!proofValid(editor.proof) ? '请粘贴有效的、与本次政策变更绑定的一次性凭证。' : undefined)
    ?? (!editor.confirmed ? '请确认预览内容与业务影响。' : undefined) : undefined;
  const error = manage.error ?? preview.error;
  return Object.freeze({
    data: query.data,
    editor,
    preview: preview.data,
    receipt,
    condition: readAllowed ? queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: query.data?.items.length === 0 }) : 'forbidden',
    error: readAllowed ? safeQueryError(query.error) : '当前账号没有读取财务政策的权限。',
    mutationError: error ? presentError(error).message : undefined,
    validation,
    busy: preview.isPending || manage.isPending,
    fetching: query.isFetching,
    canManage: canUseOperation(context, OP_FINANCE_POLICIES_PREVIEW) && canUseOperation(context, OP_FINANCE_POLICIES_MANAGE),
    actions: Object.freeze({
      refresh: () => { if (readAllowed) void query.refetch(); },
      create: () => { reset(); setEditor(Object.freeze({ mode: 'create', draft: blankPolicy(finance.createIdentity()), proof: '', confirmed: false })); },
      edit: (policy: FinancePolicy) => { reset(); setEditor(Object.freeze({ mode: 'edit', draft: editPolicy(policy), proof: '', confirmed: false })); },
      retire: (policy: FinancePolicy) => { reset(); setEditor(Object.freeze({ mode: 'retire', draft: editPolicy(policy, 'retired'), proof: '', confirmed: false })); },
      field: <TKey extends keyof PolicyDraft>(key: TKey, value: PolicyDraft[TKey]) => update({ [key]: value }),
      entry: (index: number, key: keyof FinanceEntryDraft, value: string | number) => editor && update({ entries: replaceEntry(editor.draft.entries, index, key, value) }),
      addEntry: () => update({ entries: appendEntry(editor?.draft.entries ?? []) }),
      removeEntry: (index: number) => update({ entries: removeEntry(editor?.draft.entries ?? [], index) }),
      preview: () => {
        if (!operationAllowed(context, OP_FINANCE_POLICIES_PREVIEW)) { requestStepup(); return; }
        if (editor && !policyValidation(editor.draft)) preview.mutate({ draft: editor.draft, identity });
      },
      proof: (proof: string) => setEditor((current) => current && Object.freeze({ ...current, proof, confirmed: false })),
      confirmed: (confirmed: boolean) => setEditor((current) => current && Object.freeze({ ...current, confirmed })),
      submit: () => {
        if (!editor || validation || manage.isPending) return;
        if (!operationAllowed(context, OP_FINANCE_POLICIES_MANAGE)) { requestStepup(); return; }
        manage.mutate({ editor, identity });
      },
      close: () => { if (!manage.isPending && !preview.isPending) { setEditor(undefined); preview.reset(); manage.reset(); } },
      dismissReceipt: () => setReceipt(undefined),
    }),
  });
}
