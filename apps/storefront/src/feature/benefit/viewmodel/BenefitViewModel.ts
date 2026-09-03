import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ReadBenefits } from '../application/ReadBenefits';
import { ReadLedger } from '../application/ReadLedger';
import { benefitQuery } from '../application/BenefitQuery';

export function useBenefitViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const reader = useRef(new ReadBenefits(dependencies.benefit));
  const ledger = useRef(new ReadLedger(dependencies.benefit));
  const query = useQuery({ queryKey: benefitQuery(session.scope || 'guest'), queryFn: async ({ signal }) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    const [accounts, entries] = await Promise.all([reader.current.execute(session.session, signal), ledger.current.execute(session.session, signal)]);
    return Object.freeze({ accounts, ledger: entries });
  }, enabled: session.status === 'authenticated' });
  return Object.freeze({
    state: query.isPending ? 'loading' as const : query.isError ? 'failed' as const : query.data?.accounts.length === 0 ? 'empty' as const : 'ready' as const,
    accounts: query.data?.accounts ?? Object.freeze([]), ledger: query.data?.ledger ?? Object.freeze([]),
    actions: Object.freeze({ refresh: query.refetch }),
  });
}
