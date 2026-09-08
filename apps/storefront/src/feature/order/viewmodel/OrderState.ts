import { useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { StorefrontQuery } from '../../../shared/api/Query';
import type { EnterpriseMall } from '../../account';
import { ReadOrders } from '../application/ReadOrders';
import { ReadOrder } from '../application/ReadOrder';
import { ReceiveOrder } from '../application/ReceiveOrder';
import { RemindOrder } from '../application/RemindOrder';
import { CancelOrder } from '../application/CancelOrder';
import { useDependencies } from '../../../app/DependencyContext';
import { presentError } from '@shop/presentation';

export function useOrderState(mall: EnterpriseMall, orderId?: string) {
  const session = useSession();
  const dependencies = useDependencies();
  const client = useQueryClient();
  const ordersReader = useRef(new ReadOrders(dependencies.order));
  const orderReader = useRef(new ReadOrder(dependencies.order));
  const receiveCommand = useRef(new ReceiveOrder(dependencies.order));
  const remindCommand = useRef(new RemindOrder(dependencies.order));
  const cancelCommand = useRef(new CancelOrder(dependencies.order));
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
    await Promise.all([
      client.invalidateQueries({ queryKey: StorefrontQuery.orders(session.query.scoped) }),
      client.invalidateQueries({ queryKey: StorefrontQuery.order(session.query.scoped, id) }),
    ]);
  };
  const remindOrder = async (id: string) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await remindCommand.current.execute(session.session, id);
    session.showToast('催发货请求已提交', 'success');
  };
  const cancelOrder = async (id: string, version: number, reason: string) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    await cancelCommand.current.execute(session.session, id, version, reason);
    await Promise.all([
      client.invalidateQueries({ queryKey: StorefrontQuery.orders(session.query.scoped) }),
      client.invalidateQueries({ queryKey: StorefrontQuery.order(session.query.scoped, id) }),
    ]);
  };
  return Object.freeze({
    orders,
    listState: list.isPending ? ('loading' as const) : list.isError ? ('failed' as const) : orders.length === 0 ? ('empty' as const) : ('ready' as const),
    listError: list.error ? presentError(list.error).message : null,
    refreshList: () => void list.refetch(),
    detail: detail.data ?? null,
    detailState: detail.isPending ? ('loading' as const) : detail.isError ? ('failed' as const) : detail.data === null ? ('empty' as const) : ('ready' as const),
    detailError: detail.error ? presentError(detail.error).message : null,
    refreshDetail: () => void detail.refetch(),
    receiveOrder,
    remindOrder,
    cancelOrder,
  });
}
