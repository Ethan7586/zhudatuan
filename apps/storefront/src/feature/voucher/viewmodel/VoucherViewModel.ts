import { hasFailureCode, presentError } from '@shop/presentation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import type { StorefrontSession } from '../../../entity/session';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { routePath } from '../../../generated/RouteBinding';
import { ReadVoucherDetail } from '../application/ReadVoucherDetail';
import { ReadVoucherTimeline } from '../application/ReadVoucherTimeline';
import { ReadVouchers } from '../application/ReadVouchers';
import { voucherDetailQuery, voucherQuery, voucherTimelineQuery } from './VoucherQueryKey';
import { useActivationViewModel } from './ActivationViewModel';

export function useVoucherViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const reader = useRef(new ReadVouchers(dependencies.voucher));
  const detailReader = useRef(new ReadVoucherDetail(dependencies.voucher));
  const timelineReader = useRef(new ReadVoucherTimeline(dependencies.voucher));
  const [parameters, setParameters] = useSearchParams();
  const navigate = useNavigate();
  const membership = session.session?.membership ?? null;
  const [verification, setVerification] = useState(false);
  const client = useQueryClient();
  const activation = useActivationViewModel(
    (voucher) => {
      client.setQueryData(voucherDetailQuery(session.query.scoped, membership, voucher.id), voucher);
      setParameters(
        (previous) => {
          const next = new URLSearchParams(previous);
          next.set('voucher', voucher.id);
          return next;
        },
        { replace: true }
      );
      void client.invalidateQueries({ queryKey: voucherQuery(session.query.scoped, membership) });
    },
    () => setVerification(true)
  );
  const list = useInfiniteQuery({
    queryKey: voucherQuery(session.query.scoped, membership),
    queryFn: ({ signal, pageParam }) => requiredSession(session.session, (active) => reader.current.execute(active, pageParam, signal)),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: session.status === 'authenticated',
    retry: false,
  });
  const vouchers = list.data?.pages.flatMap((page) => page.items) ?? [];
  const selected = parameters.get('voucher') || vouchers[0]?.id || null;
  const detail = useQuery({
    queryKey: voucherDetailQuery(session.query.scoped, membership, selected),
    queryFn: ({ signal }) => requiredSession(session.session, (active) => detailReader.current.execute(active, selected!, signal)),
    enabled: session.status === 'authenticated' && selected !== null,
    retry: false,
  });
  const timeline = useInfiniteQuery({
    queryKey: voucherTimelineQuery(session.query.scoped, membership, selected),
    queryFn: ({ signal, pageParam }) => requiredSession(session.session, (active) => timelineReader.current.execute(active, selected!, pageParam, signal)),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: session.status === 'authenticated' && selected !== null,
    retry: false,
  });
  const error = list.error ?? detail.error ?? timeline.error;
  const stepup = hasFailureCode(error, 'STEPUP_REQUIRED');
  useEffect(() => {
    if (stepup) setVerification(true);
  }, [stepup]);
  return Object.freeze({
    state: list.isPending ? ('loading' as const) : list.isError && !list.data ? (stepup ? ('forbidden' as const) : ('failed' as const)) : vouchers.length === 0 ? ('empty' as const) : ('ready' as const),
    detailState: selected === null ? ('empty' as const) : detail.isPending ? ('loading' as const) : detail.isError && !detail.data ? ('failed' as const) : ('ready' as const),
    timelineState: timeline.isPending ? ('loading' as const) : timeline.isError && !timeline.data ? ('failed' as const) : ('ready' as const),
    vouchers,
    selected,
    detail: detail.data ?? null,
    timeline: timeline.data?.pages.flatMap((page) => page.items) ?? [],
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    hasMoreTimeline: timeline.hasNextPage,
    loadingMoreTimeline: timeline.isFetchingNextPage,
    verification,
    activation,
    message: error && !stepup ? presentError(error).message : null,
    actions: Object.freeze({
      select: (voucher: string) =>
        setParameters(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.set('voucher', voucher);
            return next;
          },
          { replace: true }
        ),
      more: () => {
        if (list.hasNextPage && !list.isFetching) void list.fetchNextPage();
      },
      moreTimeline: () => {
        if (timeline.hasNextPage && !timeline.isFetching) void timeline.fetchNextPage();
      },
      retryTimeline: () => {
        void timeline.refetch();
      },
      retryDetail: () => {
        void detail.refetch();
      },
      openOrder: (order: string) => navigate(routePath('storeorder', { orderId: order })),
      closeVerification: () => setVerification(false),
      verified: () => {
        setVerification(false);
        void list.refetch();
        if (selected) {
          void detail.refetch();
          void timeline.refetch();
        }
      },
      refresh: () => Promise.all([list.refetch(), ...(selected ? [detail.refetch(), timeline.refetch()] : [])]),
    }),
  });
}

function requiredSession<T>(session: StorefrontSession | null, run: (session: StorefrontSession) => Promise<T>): Promise<T> {
  return session ? run(session) : Promise.reject(new Error('AUTHENTICATION_REQUIRED'));
}
