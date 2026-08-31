import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../shared/runtime/SessionContext';
import { readBenefitAccounts } from '../../benefit/public/index';
import { useCartCommand, useCartRuntime } from '../../cart/public/index';
import { CreateQuote } from './CreateQuote';
import { CommitOrder } from './CommitOrder';

export function useCheckoutRuntime() {
  const session = useSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const cart = useCartRuntime();
  const rawCart = useCartCommand();
  const quoteCommand = useRef(new CreateQuote());
  const orderCommand = useRef(new CommitOrder());
  const [isSubmittingOrder, setSubmittingOrder] = useState(false);
  const checkoutSelectedCart = async (addressId?: string) => {
    const chosen = cart.cart.filter(({ selected }) => selected);
    if (!session.session || chosen.length === 0) return false;
    setSubmittingOrder(true);
    try {
      const benefits = await readBenefitAccounts(session.session);
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
  return Object.freeze({
    ...cart,
    checkoutSelectedCart,
    isSubmittingOrder,
    showToast: session.showToast,
  });
}
