import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useDependencies } from '../../../app/DependencyContext';
import type { StorefrontSession } from '../../../entity/session';
import { ReadCheckoutOptions } from '../application/ReadCheckoutOptions';
import { checkoutOptionsQuery } from '../application/CheckoutState';
import type { Quote } from '../model/Quote';

const MAX_BENEFITS = 10;
const MAX_VOUCHERS = 20;

export function useCheckoutOptions(session: StorefrontSession | null, scope: string, quote: Quote | null, showMessage: (message: string, tone: 'error') => void) {
  const dependencies = useDependencies();
  const reader = useRef(new ReadCheckoutOptions(dependencies.benefit, dependencies.voucher));
  const [benefitOverride, setBenefitOverride] = useState<readonly string[] | null>(null);
  const [voucherOverride, setVoucherOverride] = useState<readonly string[] | null>(null);
  const query = useQuery({
    queryKey: checkoutOptionsQuery(scope),
    queryFn: ({ signal }) => reader.current.execute(session!, signal),
    enabled: session !== null,
    staleTime: 30_000,
  });
  const availableBenefits = query.data?.benefits.filter(({ status, availableMinor }) => status === 'active' && availableMinor > 0) ?? [];
  const restoredBenefits = quote?.selection.benefits.map(({ accountId }) => accountId);
  const selectedBenefits = benefitOverride ?? restoredBenefits ?? availableBenefits.map(({ id }) => id);
  const restoredVouchers = quote?.selection.voucherIds;
  const selectedVouchers = voucherOverride ?? restoredVouchers ?? Object.freeze([]);
  const toggle = (current: readonly string[], id: string, maximum: number, commit: (value: readonly string[]) => void) => {
    if (current.includes(id)) return commit(Object.freeze(current.filter((value) => value !== id)));
    if (current.length >= maximum) return showMessage(`一次最多选择 ${maximum} 项`, 'error');
    commit(Object.freeze([...current, id]));
  };
  return Object.freeze({
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : ('ready' as const),
    benefits: query.data?.benefits ?? Object.freeze([]),
    vouchers: query.data?.vouchers ?? Object.freeze([]),
    selectedBenefits,
    selectedVouchers,
    allocations: Object.freeze(availableBenefits.filter(({ id }) => selectedBenefits.includes(id)).map(({ id, availableMinor }) => Object.freeze({ accountId: id, amountMinor: availableMinor }))),
    actions: Object.freeze({
      toggleBenefit: (id: string) => toggle(selectedBenefits, id, MAX_BENEFITS, setBenefitOverride),
      toggleVoucher: (id: string) => toggle(selectedVouchers, id, MAX_VOUCHERS, setVoucherOverride),
      refresh: query.refetch,
    }),
  });
}
