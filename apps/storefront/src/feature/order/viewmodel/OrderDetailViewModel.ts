import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAccountIdentity } from '../../account/public';
import { useOrderState } from './OrderState';

export function useOrderDetailViewModel(orderId: string) {
  const navigate = useNavigate();
  const identity = useAccountIdentity();
  const orders = useOrderState(identity.currentMall, orderId);
  const [busy, setBusy] = useState<'receive' | 'remind' | null>(null);
  const order = orders.orders.find(({ id }) => id === orderId) ?? null;
  const act = async (kind: 'receive' | 'remind') => {
    if (!order) return; setBusy(kind);
    try { if (kind === 'receive') { await orders.receiveOrder(order.id, order.version); identity.showToast('订单已确认收货', 'success'); } else await orders.remindOrder(order.id); }
    catch { identity.showToast(kind === 'receive' ? '确认收货失败，请刷新订单后重试' : '催发货过于频繁或当前状态不允许', 'error'); }
    finally { setBusy(null); }
  };
  return Object.freeze({ order, busy, actions: Object.freeze({ back: () => void navigate('/orders'), remind: () => act('remind'), receive: () => act('receive'), aftersale: () => order && void navigate(`/orders/${encodeURIComponent(order.id)}/aftersales`) }) });
}
