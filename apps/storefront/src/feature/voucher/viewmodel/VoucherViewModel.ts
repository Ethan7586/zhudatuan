import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ReadVouchers } from '../application/ReadVouchers';
import { ReadRedemptions } from '../application/ReadRedemptions';
import { voucherQuery } from '../application/VoucherQuery';

export function useVoucherViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const vouchers = useRef(new ReadVouchers(dependencies.voucher));
  const redemptions = useRef(new ReadRedemptions(dependencies.voucher));
  const [verification, setVerification] = useState(false);
  const query = useQuery({ queryKey: voucherQuery(session.scope || 'guest'), queryFn: async ({ signal }) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    const [items, history] = await Promise.all([vouchers.current.execute(session.session, signal), redemptions.current.execute(session.session, signal)]);
    return Object.freeze({ vouchers: items, redemptions: history });
  }, enabled: session.status === 'authenticated', retry: false });
  const stepup = hasFailureCode(query.error, 'STEPUP_REQUIRED');
  useEffect(() => { if (stepup) setVerification(true); }, [stepup]);
  return Object.freeze({ state: query.isPending ? 'loading' as const : query.isError ? stepup ? 'denied' as const : 'failed' as const : query.data?.vouchers.length === 0 ? 'empty' as const : 'ready' as const,
    vouchers: query.data?.vouchers ?? Object.freeze([]), redemptions: query.data?.redemptions ?? Object.freeze([]), verification,
    message: query.error && !stepup ? presentError(query.error).message : null,
    actions: Object.freeze({ closeVerification: () => setVerification(false), verified: () => { setVerification(false); void query.refetch(); }, refresh: query.refetch }),
  });
}
