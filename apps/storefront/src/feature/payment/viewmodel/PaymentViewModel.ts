import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ContinuePayment } from '../application/ContinuePayment';
import { ReadPayment } from '../application/ReadPayment';
import { paymentActionMessage, paymentPollingDelay } from '../application/PaymentState';

export function usePaymentViewModel(paymentId: string) {
  const dependencies = useDependencies();
  const session = useSession();
  const reader = useRef(new ReadPayment(dependencies.payment));
  const continuation = useRef(new ContinuePayment());
  const [continuing, setContinuing] = useState(false);
  const [continuationMessage, setContinuationMessage] = useState<string | null>(null);
  const valid = /^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(paymentId);
  const query = useQuery({
    queryKey: ['storefront', session.scope || 'guest', session.session?.accessVersion ?? 0, 'payment', paymentId],
    queryFn: ({ signal }) => reader.current.execute(session.session!, paymentId, signal),
    enabled: valid && session.status === 'authenticated',
    refetchInterval: ({ state }) => paymentPollingDelay(state.data),
    refetchIntervalInBackground: true,
  });
  const continuePayment = async () => {
    if (!query.data?.action) return;
    setContinuing(true);
    setContinuationMessage(null);
    try {
      await continuation.current.execute(query.data.action);
    } catch (cause) {
      setContinuationMessage(paymentActionMessage(cause));
    } finally {
      setContinuing(false);
      await query.refetch();
    }
  };
  return Object.freeze({
    valid,
    continuing,
    continuationMessage,
    payment: query.data ?? null,
    state: !valid ? ('failed' as const) : query.isPending ? ('loading' as const) : query.isError || !query.data ? ('failed' as const) : ['captured', 'failed', 'expired'].includes(query.data.state) ? ('ready' as const) : ('stale' as const),
    actions: Object.freeze({ refresh: () => { setContinuationMessage(null); return query.refetch(); }, continuePayment }),
  });
}
