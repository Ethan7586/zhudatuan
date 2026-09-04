import { OP_QUALIFICATION_CENTER_READ, OP_QUALIFICATION_DECISIONS_PREVIEW, OP_QUALIFICATION_POLICIES_MANAGE } from '@shop/contract/ids';
import { presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { QualificationDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/query/QueryState';
import { parsePolicyRule, publishEditor, type PolicyManageCommand, type PolicyPreviewCommand, type QualificationEditor } from '../model/Command';
import type { PolicyImpact, PolicyReceipt, QualificationDecision, QualificationPolicy } from '../model/Policy';
import { useQualificationCaseViewModel } from './QualificationCaseViewModel';

export function useQualificationViewModel(context: ConsoleContext, dependencies: QualificationDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_QUALIFICATION_CENTER_READ, cursor ?? null, 50] as const),
    queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal),
  });
  const [editor, setEditor] = useState<QualificationEditor>();
  const [impact, setImpact] = useState<PolicyImpact>();
  const [decisions, setDecisions] = useState<readonly QualificationDecision[]>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<PolicyReceipt>();
  const preview = useMutation({
    mutationFn: async (target: QualificationEditor) => {
      if (target.kind === 'decision') return Object.freeze({ kind: 'decision' as const, decisions: await dependencies.preview.decision(context, required(target.member), required(target.resource)) });
      const command = previewCommand(target);
      return Object.freeze({ kind: 'policy' as const, impact: await dependencies.preview.policy(context, command) });
    },
    onSuccess: (result) => {
      if (result.kind === 'decision') setDecisions(result.decisions);
      else setImpact(result.impact);
    },
  });
  const refetch = query.refetch;
  const manage = useMutation({
    mutationFn: (command: PolicyManageCommand) => dependencies.manage.execute(context, command),
    onSuccess: async (saved) => {
      const refreshed = await refetch();
      if (refreshed.error) throw refreshed.error;
      setReceipt(saved);
      setEditor(undefined);
      setImpact(undefined);
    },
  });
  const resetPreview = useCallback(() => {
    setImpact(undefined);
    setDecisions(undefined);
    preview.reset();
    manage.reset();
    setIdentity(dependencies.createIdentity());
  }, [dependencies, manage, preview]);
  const update = useCallback(
    (change: Partial<QualificationEditor>) => {
      if (preview.isPending || manage.isPending) return;
      setEditor((current) => (current ? ({ ...current, ...change, ...(current.kind === 'decision' ? {} : { proof: '', confirmed: false }) } as QualificationEditor) : current));
      resetPreview();
    },
    [manage.isPending, preview.isPending, resetPreview]
  );
  const open = useCallback(
    (target: QualificationEditor) => {
      setEditor(target);
      setImpact(undefined);
      setDecisions(undefined);
      preview.reset();
      manage.reset();
      setIdentity(dependencies.createIdentity());
    },
    [dependencies, manage, preview]
  );
  const close = useCallback(() => {
    if (!preview.isPending && !manage.isPending) {
      setEditor(undefined);
      setImpact(undefined);
      setDecisions(undefined);
    }
  }, [manage.isPending, preview.isPending]);
  const submit = useCallback(() => {
    if (!editor || editor.kind === 'decision' || !impact || context.session.assurance.level < 3 || !editor.confirmed || !proof(editor.proof) || manage.isPending) return;
    const command: PolicyManageCommand =
      editor.kind === 'publish'
        ? { action: 'publish', policy: editor.id, name: editor.name.trim(), rule: parsePolicyRule(editor.rule), expectedVersion: editor.expectedVersion, proof: editor.proof, identity }
        : { action: 'rollback', policy: editor.policy.id, version: editor.version, expectedVersion: editor.expectedVersion, proof: editor.proof, identity };
    manage.mutate(command);
  }, [context.session.assurance.level, editor, identity, impact, manage]);
  const validation = validationMessage(editor, impact, context.session.assurance.level);
  const actions = useMemo(
    () => ({
      create: () => open(publishEditor(undefined, dependencies.createReference())),
      publish: (policy: QualificationPolicy) => open(publishEditor(policy, policy.id)),
      rollback: (policy: QualificationPolicy) => {
        const version = policy.versions.find((item) => item.version !== policy.activeVersion)?.version;
        if (version !== undefined && policy.activeVersion !== null) open({ kind: 'rollback', policy, version, expectedVersion: policy.activeVersion, proof: '', confirmed: false });
      },
      decision: () => open({ kind: 'decision', member: '', resource: '' }),
      close,
      preview: () => {
        if (editor && editorInputError(editor) === undefined && context.session.assurance.level >= 2) preview.mutate(editor);
      },
      submit,
      refresh: () => void refetch(),
      next: (value: string) => setSearch(pageCursor(search, value)),
      first: () =>
        setSearch((current) => {
          const next = new URLSearchParams(current);
          next.delete('cursor');
          return next;
        }),
      stepup: requestStepup,
      dismissReceipt: () => setReceipt(undefined),
      id: (id: string) => update({ id }),
      name: (name: string) => update({ name }),
      rule: (rule: string) => update({ rule }),
      version: (version: number) => update({ version }),
      member: (member: string) => update({ member }),
      resource: (resource: string) => update({ resource }),
      proof: (value: string) => setEditor((current) => (current && current.kind !== 'decision' ? { ...current, proof: value.trim() } : current)),
      confirmed: (confirmed: boolean) => setEditor((current) => (current && current.kind !== 'decision' ? { ...current, confirmed } : current)),
    }),
    [close, context.session.assurance.level, dependencies, editor, open, preview, refetch, requestStepup, search, setSearch, submit, update]
  );
  const page = query.data;
  const casework = useQualificationCaseViewModel(context, dependencies, requestStepup, async () => refetch());
  return Object.freeze({
    page,
    cursor,
    editor,
    impact,
    decisions,
    receipt,
    casework,
    assurance: context.session.assurance.level,
    canPreview: canUseOperation(context, OP_QUALIFICATION_DECISIONS_PREVIEW),
    canManage: canUseOperation(context, OP_QUALIFICATION_POLICIES_MANAGE),
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: (page?.items.length ?? 0) + (page?.cases.length ?? 0) === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    validation,
    previewing: Object.freeze({ busy: preview.isPending, error: preview.error ? presentError(preview.error).message : undefined }),
    saving: Object.freeze({ busy: manage.isPending, error: safeQueryError(manage.error) }),
    actions,
  });
}

function previewCommand(editor: Exclude<QualificationEditor, { kind: 'decision' }>): PolicyPreviewCommand {
  return editor.kind === 'publish' ? { kind: 'publish', policy: editor.id, name: editor.name.trim(), rule: parsePolicyRule(editor.rule) } : { kind: 'rollback', policy: editor.policy.id, version: editor.version };
}

function editorInputError(editor?: QualificationEditor): string | undefined {
  if (!editor) return undefined;
  if (editor.kind === 'decision') return editor.member.trim() && editor.resource.trim() ? undefined : '请填写成员与商品资源标识。';
  if (editor.kind === 'rollback') return editor.version === editor.expectedVersion || !editor.policy.versions.some((item) => item.version === editor.version) ? '请选择一个非当前的历史版本。' : undefined;
  if (!/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(editor.id)) return '策略标识格式应类似 policy:employee。';
  if (!editor.name.trim() || editor.name.trim().length > 255) return '策略名称应为 1–255 个字符。';
  try {
    parsePolicyRule(editor.rule);
    return undefined;
  } catch (cause) {
    return cause instanceof Error ? cause.message : '规则内容无效。';
  }
}

function validationMessage(editor: QualificationEditor | undefined, impact: PolicyImpact | undefined, assurance: number): string | undefined {
  const input = editorInputError(editor);
  if (input) return input;
  if (!editor) return undefined;
  if (assurance < 2) return '影响预览前请先完成多因素验证。';
  if (editor.kind === 'decision') return undefined;
  if (!impact) return '必须先生成服务端影响预览。';
  if (impact.currentVersion !== (editor.expectedVersion === 0 ? null : editor.expectedVersion)) return '策略版本已变化，请关闭窗口、刷新列表后重试。';
  if (impact.changedFields.length === 0) return '规则与当前版本完全相同，无需重复发布。';
  if (assurance < 3) return '发布前请完成高强度二次验证。';
  if (!proof(editor.proof)) return '请粘贴 Step-up 签发的一次性操作凭证。';
  if (!editor.confirmed) return '请确认已核对版本与影响范围。';
  return undefined;
}

function proof(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
function required(value: string): string {
  if (!value.trim()) throw new Error('成员与资源标识不能为空。');
  return value.trim();
}

export type QualificationViewModel = ReturnType<typeof useQualificationViewModel>;
