import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { useCartCommand, useCartViewModel } from '../../cart/public/index';
import { CreateQuote } from '../application/CreateQuote';
import { CommitOrder } from '../application/CommitOrder';
import { useDependencies } from '../../../app/DependencyContext';
import { ReadCurrentQuote } from '../application/ReadCurrentQuote';
import { checkoutQuery } from '../application/CheckoutState';

export function useCheckoutViewModel() {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const cart = useCartViewModel();
  const rawCart = useCartCommand();
  const quoteCommand = useRef(new CreateQuote(dependencies.checkout));
  const orderCommand = useRef(new CommitOrder(dependencies.checkout));
  const quoteReader = useRef(new ReadCurrentQuote(dependencies.checkout));
  const [isSubmittingOrder, setSubmittingOrder] = useState(false);
  const [verification, setVerification] = useState(false);
  const quote = useQuery({ queryKey: checkoutQuery(session.scope || 'guest'), queryFn: ({ signal }) => quoteReader.current.execute(session.session!, signal), enabled: session.status === 'authenticated' });
  const checkoutSelectedCart = async (addressId?: string) => {
    const chosen = cart.cart.filter(({ selected }) => selected);
    if (!session.session || chosen.length === 0) return false;
    setSubmittingOrder(true);
    try {
      const benefits = await dependencies.benefit.accounts(session.session);
      const quote = await quoteCommand.current.execute(session.session, {
        cartVersion: Number(rawCart.cart?.version ?? 0),
        lines: chosen,
        ...(addressId ? { addressId } : {}),
        benefits,
        paymentScene: 'jsapi',
      });
      if (quote.rejections.length > 0) throw new Error('CHECKOUT_REJECTED');
      const result = await orderCommand.current.execute(session.session, quote.quoteId, 'jsapi');
      void navigate(`/payments/${encodeURIComponent(result.payment.paymentId)}/result`);
      await client.invalidateQueries({ queryKey: ['storefront', session.scope] });
      return true;
    } finally {
      setSubmittingOrder(false);
    }
  };
  const selectedAddress = cart.addresses.find(({ id }) => id === search.get('address')) ?? cart.addresses[0];
  const selected = cart.cart.filter(({ selected: chosen }) => chosen);
  const submit = async () => {
    if (!selectedAddress && selected.some(({ product }) => product.itemType === 'physical')) return session.showToast('实体商品结算前必须选择收货地址', 'error');
    try { await checkoutSelectedCart(selectedAddress?.id); }
    catch (cause) { if (hasFailureCode(cause, 'STEPUP_REQUIRED')) setVerification(true); else session.showToast(presentError(cause).message, 'error'); }
  };
  return Object.freeze({
    ...cart,
    quote: quote.data ?? null,
    selectedAddress,
    selected,
    allSelected: cart.cart.length > 0 && selected.length === cart.cart.length,
    estimateMinor: selected.reduce((sum, item) => sum + item.product.priceWelfareMinor * item.quantity, 0),
    isSubmittingOrder,
    verification,
    showToast: session.showToast,
    actions: Object.freeze({
      submit,
      chooseAddress: (id: string) => { const next = new URLSearchParams(search); next.set('address', id); setSearch(next); },
      manageAddresses: () => void navigate('/profile?section=addresses'),
      manageInvoices: () => void navigate('/orders?view=invoices'),
      browse: () => void navigate('/products'),
      closeVerification: () => setVerification(false),
      verified: () => { setVerification(false); session.showToast('二次验证已完成，请再次确认提交订单', 'success'); },
    }),
  });
}
