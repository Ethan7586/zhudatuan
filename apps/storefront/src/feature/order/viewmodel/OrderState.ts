import { useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { EnterpriseMall } from '../../account';
import { ReadOrders } from '../application/ReadOrders';
import { ReadOrder } from '../application/ReadOrder';
import { ReceiveOrder } from '../application/ReceiveOrder';
import { RemindOrder } from '../application/RemindOrder';
import { toFrontendOrders } from './OrderPresentation';
import { useDependencies } from '../../../app/DependencyContext';

export function useOrderState(mall: EnterpriseMall, orderId?: string) {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const ordersReader = useRef(new ReadOrders(dependencies.order));
  const orderReader = useRef(new ReadOrder(dependencies.order));
  const receiveCommand = useRef(new ReceiveOrder(dependencies.order));
  const remindCommand = useRef(new RemindOrder(dependencies.order));
  const list = useQuery({
    queryKey: StorefrontQuery.orders(session.query.scoped),
    queryFn: ({ signal }) => ordersReader.current.execute(session.session!, mall, signal),
    enabled: session.status === 'authenticated' && mall.id !== 'unresolved',
  });
  const detail = useQuery({
    queryKey: StorefrontQuery.order(session.query.scoped, orderId ?? 'none'),
    queryFn: ({ signal }) => orderReader.current.execute(session.session!, mall, orderId!, signal),
    enabled: session.status === 'authenticated' && Boolean(orderId),
  });
  const orders = useMemo(() => (detail.data && !(list.data ?? []).some(({ id }) => id === detail.data?.id) ? Object.freeze([detail.data, ...(list.data ?? [])]) : (list.data ?? Object.freeze([]))), [detail.data, list.data]);
  const receiveOrder = async (id: string, version: number) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await receiveCommand.current.execute(session.session, id, version);
    await client.invalidateQueries({ queryKey: StorefrontQuery.orders(session.query.scoped) });
  };
  const remindOrder = async (id: string) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await remindCommand.current.execute(session.session, id);
    session.showToast('催发货请求已提交', 'success');
  };
  return Object.freeze({ orders, presentationOrders: toFrontendOrders(orders, []), receiveOrder, remindOrder });
}
