import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hasFailureCode, presentError } from '@shop/presentation';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { useCartCommand, useCartViewModel } from '../../cart';
import { CreateQuote } from '../application/CreateQuote';
import { CommitOrder } from '../application/CommitOrder';
import { useDependencies } from '../../../app/DependencyContext';
import { ReadCurrentQuote } from '../application/ReadCurrentQuote';
import { checkoutQuery, checkoutState } from '../application/CheckoutState';
import { checkoutDraft } from '../model/CheckoutDraft';
import { useCheckoutOptions } from './CheckoutOptionsViewModel';

export function useCheckoutViewModel() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const [verification, setVerification] = useState(false);
  const [now, setNow] = useState(Date.now());
  const cart = useCartViewModel();
  const rawCart = useCartCommand();
  const quoteCommand = useRef(new CreateQuote(dependencies.checkout));
  const orderCommand = useRef(new CommitOrder(dependencies.checkout));
  const quoteReader = useRef(new ReadCurrentQuote(dependencies.checkout));
  const key = checkoutQuery(session.scope || 'guest');
  const current = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => quoteReader.current.execute(session.session!, signal),
    enabled: session.status === 'authenticated',
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const options = useCheckoutOptions(session.session, session.scope || 'guest', current.data ?? null, session.showToast);
  const selected = cart.cart.filter(({ selected: chosen }) => chosen);
  const selectedAddress = cart.addresses.find(({ id }) => id === search.get('address'))
    ?? cart.addresses.find(({ id }) => id === current.data?.selection.addressId)
    ?? cart.addresses[0];
  const draft = checkoutDraft({
    cartVersion: Number(rawCart.cart?.version ?? 0),
    lines: selected.map(({ listingId, quantity, lineVersion }) => ({ listingId, quantity, lineVersion })),
    addressId: selectedAddress?.id ?? null,
    voucherIds: options.selectedVouchers,
    benefits: options.allocations,
  });
  const quote = useMutation({
    mutationFn: () => requiredSession(session.session, (active) => quoteCommand.current.execute(active, draft)),
    onSuccess: (value) => client.setQueryData(key, value),
  });
  const order = useMutation({
    mutationFn: async () => {
      const value = current.data;
      if (!session.session || !value?.confirmationToken) throw new Error('PRICE_QUOTE_EXPIRED');
      return orderCommand.current.execute(session.session, value.quoteId, value.confirmationToken, value.selection.paymentScene);
    },
    onSuccess: async (value) => {
      await client.invalidateQueries({ queryKey: ['storefront', session.scope] });
      void navigate(routePath('storepayment', { paymentId: value.payment.paymentId }));
    },
  });
  const state = checkoutState({
    draft,
    quote: current.data ?? null,
    loading: cart.isLoading || current.isPending || options.state === 'loading',
    failed: cart.failed || options.state === 'failed',
    quoting: quote.isPending,
    committing: order.isPending,
    now,
  });

  useEffect(() => {
    const expiry = current.data ? Date.parse(current.data.expiresAt) : Number.NaN;
    if (!Number.isFinite(expiry)) return;
    const delay = expiry - Date.now();
    if (delay <= 0) return setNow(Date.now());
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(delay + 50, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [current.data?.expiresAt]);

  const report = (cause: unknown) => {
    if (hasFailureCode(cause, 'STEPUP_REQUIRED')) setVerification(true);
    else session.showToast(presentError(cause).message, 'error');
  };
  const createQuote = async () => {
    if (selected.length === 0) return;
    if (!selectedAddress && selected.some(({ product }) => product.itemType === 'physical')) return session.showToast('实体商品报价前必须选择收货地址', 'error');
    try { await quote.mutateAsync(); } catch (cause) { report(cause); }
  };
  const commitOrder = async () => {
    try { await order.mutateAsync(); } catch (cause) { report(cause); }
  };
  return Object.freeze({
    ...cart,
    quote: state.quote,
    checkout: state,
    options,
    selectedAddress,
    selected,
    allSelected: cart.cart.length > 0 && selected.length === cart.cart.length,
    verification,
    actions: Object.freeze({
      submit: () => state.canCommit ? commitOrder() : state.canQuote ? createQuote() : Promise.resolve(),
      chooseAddress: (id: string) => {
        const next = new URLSearchParams(search);
        next.set('address', id);
        setSearch(next);
      },
      manageAddresses: () => void navigate(`${ROUTES.storeprofile}?section=addresses`),
      manageInvoices: () => void navigate(`${ROUTES.storeorders}?view=invoices`),
      browse: () => void navigate(ROUTES.storecatalog),
      closeVerification: () => setVerification(false),
      verified: () => {
        setVerification(false);
        session.showToast('二次验证已完成，请重新执行刚才的安全操作', 'success');
      },
    }),
  });
}

function requiredSession<T>(session: ReturnType<typeof useSession>['session'], run: (active: NonNullable<typeof session>) => Promise<T>): Promise<T> {
  return session ? run(session) : Promise.reject(new Error('AUTHENTICATION_REQUIRED'));
}
