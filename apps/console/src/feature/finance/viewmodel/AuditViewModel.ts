import { OP_FINANCE_AUDIT_READ } from '@shop/contract/ids';
import { queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { FinanceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { defineQueryState, trimmedQuery } from '../../../shared/query/QueryState';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import { financeAuditKey } from './FinanceQueryKey';
import { useFinanceNavigationViewModel } from './NavigationViewModel';

const auditQuery = defineQueryState({ reference: trimmedQuery(200) });

export function useAuditViewModel(context: ConsoleContext, dependencies: FinanceDependencies) {
  const [search, setSearch] = useSearchParams();
  const reference = auditQuery.read(search).reference;
  const [draft, setDraft] = useState(reference ?? '');
  const allowed = canUseOperation(context, OP_FINANCE_AUDIT_READ);
  const ready = allowed && context.session.assurance.level >= requiredAssurance(OP_FINANCE_AUDIT_READ);
  useEffect(() => setDraft(reference ?? ''), [reference]);
  const query = useQuery({
    queryKey: financeAuditKey(context, reference ?? ''),
    queryFn: ({ signal }) => dependencies.readAudit.execute(context, reference ?? '', signal),
    enabled: ready && reference !== undefined,
  });
  const data = query.data;
  return Object.freeze({
    navigation: useFinanceNavigationViewModel(context, 'audit'),
    reference,
    draft,
    data,
    condition: allowed
      ? ready
        ? reference === undefined
          ? ('ready' as const)
          : queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: data !== undefined, empty: false })
        : ('forbidden' as const)
      : ('forbidden' as const),
    error: allowed ? safeQueryError(query.error) : '当前账号没有查询财务业务证据链的权限。',
    needsStepup: allowed && !ready,
    setDraft,
    search: () => {
      const nextReference = auditQuery.read(auditQuery.patch(search, { reference: draft })).reference;
      if (nextReference === undefined) return;
      setSearch((current) => auditQuery.patch(current, { reference: nextReference }));
    },
    clear: () => {
      setDraft('');
      setSearch((current) => auditQuery.patch(current, { reference: undefined }), { replace: true });
    },
    refresh: () => {
      if (ready && reference !== undefined) void query.refetch();
    },
  });
}

export type AuditViewModel = ReturnType<typeof useAuditViewModel>;
