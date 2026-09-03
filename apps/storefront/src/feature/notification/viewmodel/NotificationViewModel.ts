import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ChangePreference } from '../application/ChangePreference';
import { MarkNotification } from '../application/MarkNotification';
import { ReadNotifications } from '../application/ReadNotifications';
import { notificationQuery } from '../application/NotificationQuery';
import type { Notification, NotificationChannel } from '../model/Notification';

export function useNotificationViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const cache = useQueryClient();
  const scope = session.scope || 'guest';
  const reader = useRef(new ReadNotifications(dependencies.notification));
  const mark = useRef(new MarkNotification(dependencies.notification));
  const change = useRef(new ChangePreference(dependencies.notification));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: notificationQuery(scope), queryFn: ({ signal }) => {
    if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
    return reader.current.execute(session.session, undefined, signal);
  }, enabled: session.status === 'authenticated' });
  const refresh = () => cache.invalidateQueries({ queryKey: notificationQuery(scope) });
  const acknowledge = async (item: Notification) => run(`notification:${item.id}`, async () => {
    if (session.session && !item.readAt) await mark.current.execute(session.session, item.id);
  });
  const toggle = async (channel: NotificationChannel, eventType: string, enabled: boolean) => run(`preference:${channel}:${eventType}`, async () => {
    if (session.session) await change.current.execute(session.session, channel, eventType, enabled);
  });
  async function run(key: string, action: () => Promise<void>) {
    setBusy(key); setError(null);
    try { await action(); await refresh(); } catch (cause) { setError(presentError(cause).message); } finally { setBusy(null); }
  }
  return Object.freeze({
    state: query.isPending ? 'loading' as const : query.isError ? 'failed' as const : query.data?.notifications.items.length === 0 ? 'empty' as const : 'ready' as const,
    notifications: query.data?.notifications.items ?? Object.freeze([]), preferences: query.data?.preferences ?? Object.freeze([]),
    busy, message: error ?? (query.isError ? '通知信息加载失败，请重试' : null), fetching: query.isFetching,
    actions: Object.freeze({ refresh, acknowledge, toggle }),
  });
}
