import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ReadBenefits } from '../application/ReadBenefits';
import { ReadLedger } from '../application/ReadLedger';
import { benefitAccountQuery, benefitLedgerQuery } from './BenefitQueryKey';

export function useBenefitViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const reader = useRef(new ReadBenefits(dependencies.benefit));
  const ledger = useRef(new ReadLedger(dependencies.benefit));
  const accounts = useQuery({
    queryKey: benefitAccountQuery(session.query.scoped),
    queryFn: ({ signal }) => reader.current.execute(required(session.session), signal),
    enabled: session.status === 'authenticated',
  });
  const entries = useQuery({
    queryKey: benefitLedgerQuery(session.query.scoped),
    queryFn: ({ signal }) => ledger.current.execute(required(session.session), signal),
    enabled: session.status === 'authenticated',
  });
  return Object.freeze({
    state: state(accounts, accounts.data?.length ?? 0),
    ledgerState: state(entries, entries.data?.length ?? 0),
    accounts: accounts.data ?? Object.freeze([]),
    ledger: entries.data ?? Object.freeze([]),
    accountMessage: accounts.error ? presentError(accounts.error).message : null,
    ledgerMessage: entries.error ? presentError(entries.error).message : null,
    refreshing: accounts.isFetching || entries.isFetching,
    actions: Object.freeze({
      refresh: () => Promise.all([accounts.refetch(), entries.refetch()]),
      retryAccounts: () => void accounts.refetch(),
      retryLedger: () => void entries.refetch(),
    }),
  });
}

function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}

function state(query: Readonly<{ isPending: boolean; isError: boolean }>, count: number) {
  return query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : count === 0 ? ('empty' as const) : ('ready' as const);
}
