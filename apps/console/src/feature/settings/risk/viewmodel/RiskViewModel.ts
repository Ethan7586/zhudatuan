import { OP_RISK_CASES_REVIEW, OP_RISK_CENTER_READ, OP_RISK_POLICIES_MANAGE } from '@shop/contract/ids';
import { hasFailureCode, presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { RiskDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/query/QueryState';
import { caseEditor, parseEvidence, parseRiskRule, saveEditor, type RiskCommand, type RiskEditor } from '../model/Command';
import type { RiskCase, RiskCaseAction, RiskPolicy, RiskReceipt } from '../model/Risk';

export function useRiskViewModel(context: ConsoleContext, dependencies: RiskDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({
    queryKey: Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_RISK_CENTER_READ, cursor ?? null, 50] as const),
    queryFn: ({ signal }) => dependencies.read.execute(context, cursor, signal),
  });
  const [editor, setEditor] = useState<RiskEditor>();
  const [reviewing, setReviewing] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [approval, setApproval] = useState<string>();
  const [approvalError, setApprovalError] = useState<string>();
  const [receipt, setReceipt] = useState<RiskReceipt>();
  const resolved = useMemo(() => resolve(editor, identity), [editor, identity]);
  const refetch = query.refetch;
  const mutation = useMutation({
    mutationFn: (command: RiskCommand) => (command.kind === 'policy' ? dependencies.managePolicy.execute(context, command.change) : dependencies.reviewCase.execute(context, command.change)),
    onSuccess: async (value) => {
      const refreshed = await refetch();
      if (refreshed.error) throw refreshed.error;
      setReceipt(value);
      setEditor(undefined);
      setReviewing(false);
      setApproval(undefined);
    },
  });
  const resetApproval = useCallback(() => {
    setReviewing(false);
    setApproval(undefined);
    setApprovalError(undefined);
    setIdentity(dependencies.createIdentity());
    mutation.reset();
  }, [dependencies, mutation]);
  const update = useCallback(
    (change: Partial<RiskEditor>) => {
      if (mutation.isPending) return;
      setEditor((current) => (current ? ({ ...current, ...change, proof: '', confirmed: false } as RiskEditor) : current));
      resetApproval();
    },
    [mutation.isPending, resetApproval]
  );
  const open = useCallback(
    (value: RiskEditor) => {
      setEditor(value);
      setReviewing(false);
      setApproval(undefined);
      setApprovalError(undefined);
      setIdentity(dependencies.createIdentity());
      mutation.reset();
    },
    [dependencies, mutation]
  );
  const close = useCallback(() => {
    if (!mutation.isPending) {
      setEditor(undefined);
      setReviewing(false);
      setApproval(undefined);
    }
  }, [mutation.isPending]);
  const prepare = useCallback(async () => {
    if (!resolved.command || resolved.error || !reviewing) return;
    setApprovalError(undefined);
    try {
      setApproval(await dependencies.prepare.execute(context, resolved.command));
    } catch (cause) {
      setApprovalError(presentError(cause).message);
    }
  }, [context, dependencies, resolved, reviewing]);
  const submit = useCallback(() => {
    if (!resolved.command || resolved.error || !reviewing || context.session.assurance.level < 3 || !editor?.confirmed || !proof(editor.proof) || mutation.isPending) return;
    mutation.mutate(resolved.command);
  }, [context.session.assurance.level, editor, mutation, resolved, reviewing]);
  const actions = useMemo(
    () =>
      Object.freeze({
        create: () => open(saveEditor(undefined, dependencies.createReference())),
        revise: (policy: RiskPolicy) => open(saveEditor(policy, policy.id)),
        activate: (policy: RiskPolicy) => (policy.candidateVersion === null ? undefined : open({ kind: 'activate', policy, rolloutPercent: policy.candidateRollout ?? 100, expectedVersion: policy.version, proof: '', confirmed: false })),
        retire: (policy: RiskPolicy) => open({ kind: 'retire', policy, expectedVersion: policy.version, proof: '', confirmed: false }),
        reviewCase: (riskCase: RiskCase, action: RiskCaseAction) => open(caseEditor(riskCase, action)),
        preview: () => {
          if (!resolved.error) {
            setReviewing(true);
            setApproval(undefined);
          }
        },
        edit: resetApproval,
        prepare: () => void prepare(),
        submit,
        close,
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
        rollout: (rolloutPercent: number) => update({ rolloutPercent }),
        caseAction: (action: RiskCaseAction) => update({ action }),
        reason: (reason: string) => update({ reason }),
        evidence: (evidence: string) => update({ evidence }),
        proof: (value: string) => setEditor((current) => (current ? { ...current, proof: value.trim() } : current)),
        confirmed: (confirmed: boolean) => setEditor((current) => (current ? { ...current, confirmed } : current)),
      }),
    [close, dependencies, open, prepare, refetch, requestStepup, resetApproval, resolved.error, search, setSearch, submit, update]
  );
  const page = query.data;
  const canWrite = canUseOperation(context, OP_RISK_POLICIES_MANAGE);
  return Object.freeze({
    page,
    cursor,
    editor,
    reviewing,
    receipt,
    assurance: context.session.assurance.level,
    canWrite,
    canReview: canUseOperation(context, OP_RISK_CASES_REVIEW),
    needsReadStepup: hasFailureCode(query.error, 'STEPUP_REQUIRED'),
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: false }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    validation: validation(editor, resolved.error, reviewing, context.session.assurance.level),
    approval: Object.freeze({ request: approval, error: approvalError }),
    mutation: Object.freeze({ busy: mutation.isPending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

function resolve(editor: RiskEditor | undefined, identity: string): Readonly<{ command?: RiskCommand; error?: string }> {
  if (!editor) return Object.freeze({});
  try {
    if (editor.kind === 'save') {
      if (!/^riskpolicy:[A-Za-z0-9-]+$/.test(editor.id)) throw new Error('策略标识格式应类似 riskpolicy:checkout。');
      if (!editor.name.trim() || editor.name.trim().length > 255) throw new Error('策略名称应为 1–255 个字符。');
      if (!Number.isSafeInteger(editor.rolloutPercent) || editor.rolloutPercent < 0 || editor.rolloutPercent > 100) throw new Error('流量比例必须是 0–100 的整数。');
      return {
        command: {
          kind: 'policy',
          change: { action: 'save', policy: editor.id, name: editor.name.trim(), rule: parseRiskRule(editor.rule), rolloutPercent: editor.rolloutPercent, expectedVersion: editor.expectedVersion, proof: editor.proof, identity },
        },
      };
    }
    if (editor.kind === 'activate') {
      if (!Number.isSafeInteger(editor.rolloutPercent) || editor.rolloutPercent < 0 || editor.rolloutPercent > 100) throw new Error('激活流量比例必须是 0–100 的整数。');
      if (editor.policy.replayState !== 'passed') throw new Error('候选版本尚未通过服务端历史回放。');
      return {
        command: {
          kind: 'policy',
          change: { action: 'activate', policy: editor.policy.id, version: required(editor.policy.candidateVersion), rolloutPercent: editor.rolloutPercent, expectedVersion: editor.expectedVersion, proof: editor.proof, identity },
        },
      };
    }
    if (editor.kind === 'retire') return { command: { kind: 'policy', change: { action: 'retire', policy: editor.policy.id, expectedVersion: editor.expectedVersion, proof: editor.proof, identity } } };
    if (editor.reason.trim().length < 4 || editor.reason.trim().length > 1000) throw new Error('复核原因应为 4–1,000 个字符。');
    return {
      command: { kind: 'case', change: { case: editor.riskCase.id, action: editor.action, reason: editor.reason.trim(), evidence: parseEvidence(editor.evidence), expectedVersion: editor.expectedVersion, proof: editor.proof, identity } },
    };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : '操作内容无效。' };
  }
}

function validation(editor: RiskEditor | undefined, error: string | undefined, reviewing: boolean, assurance: number): string | undefined {
  if (error) return error;
  if (!editor) return undefined;
  if (!reviewing) return undefined;
  if (assurance < 3) return '执行前请完成高强度二次验证。';
  if (!proof(editor.proof)) return '请粘贴另一位管理员签发的一次性复核凭证。';
  if (!editor.confirmed) return '请确认已核对预览、影响和目标版本。';
  return undefined;
}
function proof(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}
function required(value: number | null): number {
  if (value === null) throw new Error('候选版本不存在。');
  return value;
}

export type RiskViewModel = ReturnType<typeof useRiskViewModel>;
