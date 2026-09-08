import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ChangePreference } from '../application/ChangePreference';
import { MarkNotification } from '../application/MarkNotification';
import { ReadNotifications } from '../application/ReadNotifications';
import { ReadPreferences } from '../application/ReadPreferences';
import { notificationItemsQuery, notificationPreferenceQuery, notificationQuery } from './NotificationQueryKey';
import type { Notification } from '../model/Notification';
import type { NotificationPreference } from '../model/NotificationPreference';

export function useNotificationViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const cache = useQueryClient();
  const reader = useRef(new ReadNotifications(dependencies.notification));
  const preferenceReader = useRef(new ReadPreferences(dependencies.notification));
  const mark = useRef(new MarkNotification(dependencies.notification));
  const change = useRef(new ChangePreference(dependencies.notification));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const notifications = useInfiniteQuery({
    queryKey: notificationItemsQuery(session.query.scoped),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ signal, pageParam }) => {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      return reader.current.execute(session.session, pageParam, signal);
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: session.status === 'authenticated',
  });
  const preferences = useQuery({
    queryKey: notificationPreferenceQuery(session.query.scoped),
    queryFn: ({ signal }) => {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      return preferenceReader.current.execute(session.session, signal);
    },
    enabled: session.status === 'authenticated',
  });
  const refresh = () => cache.invalidateQueries({ queryKey: notificationQuery(session.query.scoped) });
  const acknowledge = async (item: Notification) =>
    run(`notification:${item.id}`, async () => {
      if (session.session && !item.readAt) await mark.current.execute(session.session, item.id);
    });
  const toggle = async (preference: NotificationPreference, enabled: boolean) =>
    run(`preference:${preference.channel}:${preference.eventType}`, async () => {
      if (preference.channel === 'wechat' && enabled && preference.authorization !== 'accepted') {
        throw new Error('请先在微信端完成服务通知授权，再开启该消息');
      }
      if (session.session) await change.current.execute(session.session, preference, { enabled });
    });
  const quiet = async (preference: NotificationPreference, start: string, end: string, enabled: boolean) =>
    run(`preference:${preference.channel}:${preference.eventType}`, async () => {
      if (session.session) await change.current.execute(session.session, preference, { quietHours: enabled ? { start, end, timezone: 'Asia/Shanghai' } : null });
    });
  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }
  return Object.freeze({
    notificationState: notifications.isPending ? ('loading' as const) : notifications.isError ? ('failed' as const) : notifications.data.pages.every((page) => page.items.length === 0) ? ('empty' as const) : ('ready' as const),
    preferenceState: preferences.isPending ? ('loading' as const) : preferences.isError ? ('failed' as const) : preferences.data.length === 0 ? ('empty' as const) : ('ready' as const),
    notifications: notifications.data?.pages.flatMap((page) => page.items) ?? Object.freeze([]),
    preferences: preferences.data ?? Object.freeze([]),
    busy,
    message: error,
    notificationMessage: notifications.isError ? presentError(notifications.error).message : null,
    preferenceMessage: preferences.isError ? presentError(preferences.error).message : null,
    fetching: notifications.isFetching || preferences.isFetching,
    loadingMore: notifications.isFetchingNextPage,
    hasMore: notifications.hasNextPage,
    actions: Object.freeze({
      refresh,
      retryNotifications: notifications.refetch,
      retryPreferences: preferences.refetch,
      loadMore: notifications.fetchNextPage,
      acknowledge,
      toggle,
      quiet,
    }),
  });
}
