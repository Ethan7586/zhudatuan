import { Bell, Check, CircleAlert, LoaderCircle, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { presentError } from '@shop/presentation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useSession } from '../../../shared/runtime/SessionContext';
import { notificationQuery } from '../application/NotificationQuery';
import { readNotifications } from '../application/ReadNotifications';
import { MarkNotification } from '../application/MarkNotification';
import { ChangePreference } from '../application/ChangePreference';
import type { Notification, NotificationChannel } from '../model/Notification';

export function NotificationPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const scope = session.scope || 'guest';
  const mark = useRef(new MarkNotification());
  const change = useRef(new ChangePreference());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: notificationQuery(scope),
    queryFn: ({ signal }) => {
      if (!session.session) throw new Error('AUTHENTICATION_REQUIRED');
      return readNotifications(session.session, undefined, signal);
    },
    enabled: session.status === 'authenticated',
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationQuery(scope) });

  async function acknowledge(item: Notification) {
    if (!session.session || item.readAt) return;
    setBusy(`notification:${item.id}`);
    setError(null);
    try {
      await mark.current.execute(session.session, item.id);
      await refresh();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggle(channel: NotificationChannel, eventType: string, enabled: boolean) {
    if (!session.session) return;
    const key = `preference:${channel}:${eventType}`;
    setBusy(key);
    setError(null);
    try {
      await change.current.execute(session.session, channel, eventType, enabled);
      await refresh();
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="sw-web-container mx-auto max-w-[1240px] px-3 py-5 text-xs">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">SMART WING MESSAGE</p>
          <h1 className="mt-1 text-xl font-black text-gray-900">通知中心</h1>
          <p className="mt-1 text-gray-500">订单、卡券、售后和企业公告均来自服务端真实投递记录。</p>
        </div>
        <button type="button" disabled={query.isFetching} onClick={() => void refresh()} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 font-bold disabled:opacity-50">
          <RefreshCw size={14} className={query.isFetching ? 'animate-spin' : ''} />
          刷新
        </button>
      </header>
      {error || query.isError ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />
          {error ?? '通知信息加载失败，请重试'}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-2">
          {query.isPending ? <State text="正在读取通知…" /> : null}
          {query.data?.notifications.items.map((item) => (
            <article key={item.id} className={`rounded-xl border bg-white p-4 shadow-sm ${item.readAt ? 'border-gray-100' : 'border-blue-200 ring-1 ring-blue-50'}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.readAt ? 'bg-gray-100 text-gray-500' : 'bg-blue-50 text-[var(--sw-brand)]'}`}>
                  {item.kind === 'announcement' ? <Bell size={17} /> : icon(item.channel)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="text-sm text-gray-900">{item.subject ?? eventLabel(item.eventType)}</b>
                    <time className="text-gray-400">{format(item.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-5 text-gray-600">{item.body}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-gray-400">
                      {channelLabel(item.channel)} · {item.state}
                    </span>
                    {item.readAt ? (
                      <span className="inline-flex items-center gap-1 text-gray-400">
                        <Check size={13} />
                        已读
                      </span>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => void acknowledge(item)} className="rounded-md bg-blue-50 px-2.5 py-1.5 font-bold text-[var(--sw-brand)] disabled:opacity-50">
                        {busy === `notification:${item.id}` ? '保存中…' : '标记已读'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {query.data && query.data.notifications.items.length === 0 ? <State text="暂无通知" /> : null}
        </div>
        <aside className="h-fit rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-gray-900">消息偏好</h2>
          <p className="mt-1 text-gray-500">关闭后不影响交易处理；微信订阅会同步记录授权状态。</p>
          <div className="mt-4 divide-y">
            {query.data?.preferences.map((item) => {
              const key = `preference:${item.channel}:${item.eventType}`;
              return (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-3 py-3">
                  <span>
                    <b className="block text-gray-800">{eventLabel(item.eventType)}</b>
                    <span className="text-gray-400">
                      {channelLabel(item.channel)}
                      {item.channel === 'wechat' ? ` · ${authorizationLabel(item.authorization)}` : ''}
                    </span>
                  </span>
                  <input
                    aria-label={`${eventLabel(item.eventType)}${channelLabel(item.channel)}`}
                    type="checkbox"
                    checked={item.enabled}
                    disabled={busy !== null}
                    onChange={(event) => void toggle(item.channel, item.eventType, event.target.checked)}
                    className="h-4 w-4 accent-[var(--sw-brand)]"
                  />
                </label>
              );
            })}
            {query.data && query.data.preferences.length === 0 ? <p className="py-6 text-center text-gray-400">商城尚未发布可配置的消息模板</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function State({ text }: { readonly text: string }) {
  return (
    <div role="status" className="grid min-h-32 place-items-center rounded-xl border border-dashed bg-white text-gray-400">
      <span className="inline-flex items-center gap-2">
        <LoaderCircle size={17} className="animate-spin" />
        {text}
      </span>
    </div>
  );
}
function icon(channel: NotificationChannel) {
  return channel === 'email' ? <Mail size={17} /> : channel === 'wechat' || channel === 'sms' ? <MessageCircle size={17} /> : <Bell size={17} />;
}
function channelLabel(channel: NotificationChannel): string {
  return ({ inapp: '站内消息', wechat: '微信服务通知', sms: '短信', email: '邮件' } as const)[channel];
}
function authorizationLabel(value: string): string {
  return ({ accepted: '已授权', rejected: '未授权', unknown: '待授权' } as Record<string, string>)[value] ?? '待授权';
}
function eventLabel(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    'order.created': '订单已创建',
    'payment.captured': '支付成功',
    'fulfillment.shipped': '订单已发货',
    'order.received': '订单已签收',
    'voucher.issued': '卡券已发放',
    'aftersale.updated': '售后进度更新',
  };
  return labels[value] ?? value;
}
function format(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
