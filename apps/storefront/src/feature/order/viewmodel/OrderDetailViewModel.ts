import { useState } from 'react';
import { useNavigate } from 'react-router';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { useAccountIdentity } from '../../account';
import { useOrderState } from './OrderState';
import { hasFailureCode, presentError } from '@shop/presentation';

export function useOrderDetailViewModel(orderId: string) {
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const orders = useOrderState(identity.currentMall, orderId);
  const [busy, setBusy] = useState<'receive' | 'remind' | 'cancel' | null>(null);
  const [cancel, setCancel] = useState<Readonly<{ reason: string; confirmed: boolean }> | null>(null);
  const [verification, setVerification] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const order = orders.detail;
  const act = async (kind: 'receive' | 'remind' | 'cancel') => {
    if (!order) return;
    setBusy(kind);
    setMessage(null);
    try {
      if (kind === 'cancel') {
        if (!cancel || cancel.reason.trim().length < 2 || !cancel.confirmed) return;
        await orders.cancelOrder(order.id, order.version, cancel.reason.trim());
        setCancel(null);
        identity.showToast('订单已取消，相关未完成支付与履约将停止', 'success');
      } else if (kind === 'receive') {
        await orders.receiveOrder(order.id, order.version);
        identity.showToast('订单已确认收货', 'success');
      } else await orders.remindOrder(order.id);
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) setVerification(true);
      else setMessage(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  };
  return Object.freeze({
    order,
    state: orders.detailState,
    error: orders.detailError ?? message,
    busy,
    cancel,
    verification,
    actions: Object.freeze({
      back: () => void navigate(ROUTES.storeorders),
      refresh: orders.refreshDetail,
      remind: () => act('remind'),
      receive: () => act('receive'),
      openCancel: () => { setMessage(null); setCancel({ reason: '', confirmed: false }); },
      closeCancel: () => { if (busy !== 'cancel') setCancel(null); },
      cancelReason: (reason: string) => setCancel((current) => current ? { ...current, reason, confirmed: false } : current),
      cancelConfirmed: (confirmed: boolean) => setCancel((current) => current ? { ...current, confirmed } : current),
      submitCancel: () => act('cancel'),
      aftersale: () => order && void navigate(routePath('storeaftersale', { orderId: order.id })),
      closeVerification: () => setVerification(false),
      verified: () => {
        setVerification(false);
        identity.showToast('二次验证已完成，请再次确认操作', 'success');
      },
    }),
  });
}
