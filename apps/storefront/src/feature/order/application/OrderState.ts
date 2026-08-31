import { useMemo, useRef } from 'react';
import { useLocation } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../shared/runtime/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { MallView } from '../../../shared/runtime/StorefrontPort';
import { ReadOrders } from './ReadOrders';
import { ReadOrder } from './ReadOrder';
import { ReceiveOrder } from './ReceiveOrder';
import { RemindOrder } from './RemindOrder';
import { toFrontendOrders } from '../infrastructure/OrderMapper';
import { resourceId } from '../../../shared/manifest/StorefrontRoute';

export function useOrderState(mall: MallView) {
  const session = useSession();
  const location = useLocation();
  const client = useQueryClient();
  const scope = session.scope || 'guest';
  const ordersReader = useRef(new ReadOrders());
  const orderReader = useRef(new ReadOrder());
  const receiveCommand = useRef(new ReceiveOrder());
  const remindCommand = useRef(new RemindOrder());
  const list = useQuery({
    queryKey: StorefrontQuery.orders(scope),
    queryFn: ({ signal }) => ordersReader.current.execute(session.session!, mall, signal),
    enabled: session.status === 'authenticated' && mall.id !== 'unresolved',
  });
  const orderId = resourceId(location.pathname, 'orders');
  const detail = useQuery({
    queryKey: StorefrontQuery.order(scope, orderId ?? 'none'),
    queryFn: ({ signal }) => orderReader.current.execute(session.session!, mall, orderId!, signal),
    enabled: session.status === 'authenticated' && Boolean(orderId) && !location.pathname.endsWith('/aftersales'),
  });
  const orders = useMemo(() => (detail.data && !(list.data ?? []).some(({ id }) => id === detail.data?.id) ? Object.freeze([detail.data, ...(list.data ?? [])]) : (list.data ?? Object.freeze([]))), [detail.data, list.data]);
  const receiveOrder = async (id: string, version: number) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await receiveCommand.current.execute(session.session, id, version);
    await client.invalidateQueries({ queryKey: StorefrontQuery.orders(scope) });
  };
  const remindOrder = async (id: string) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await remindCommand.current.execute(session.session, id);
    session.showToast('催发货请求已提交', 'success');
  };
  return Object.freeze({ orders, presentationOrders: toFrontendOrders(orders, []), receiveOrder, remindOrder });
}
