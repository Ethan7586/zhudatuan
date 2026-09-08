import { Bell, Check, CircleAlert, LoaderCircle, Mail, MessageCircle, RefreshCw } from 'lucide-react';
import { chineseDomainLabel } from '@shop/presentation';
import type { NotificationChannel } from '../model/Notification';
import type { useNotificationViewModel } from '../viewmodel/NotificationViewModel';

export function NotificationPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useNotificationViewModel> }>) {
  const { notificationState, preferenceState, notifications, preferences, busy, message, notificationMessage, preferenceMessage, fetching, loadingMore, hasMore, actions } = viewmodel;

  return (
    <section className="sw-web-container mx-auto max-w-[1240px] px-3 py-5 text-xs">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">智慧翼 · 消息中心</p>
          <h1 className="mt-1 text-xl font-black text-content">通知中心</h1>
          <p className="mt-1 text-muted">订单、卡券、售后和企业公告均来自服务端真实投递记录。</p>
        </div>
        <button type="button" disabled={fetching} onClick={() => void actions.refresh()} className="inline-flex items-center gap-1 rounded-lg border bg-surface px-3 py-2 font-bold disabled:opacity-50">
          <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
          刷新
        </button>
      </header>
      {message ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-danger-surface p-3 font-bold text-danger-strong">
          <CircleAlert size={16} />
          {message}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
        <div className="space-y-2">
          {notificationState === 'loading' ? <State kind="loading" text="正在读取通知…" /> : null}
          {notificationState === 'failed' ? <State kind="failed" text={notificationMessage ?? '通知加载失败'} retry={() => void actions.retryNotifications()} /> : null}
          {notifications.map((item) => (
            <article key={item.id} className={`rounded-xl border bg-surface p-4 shadow-sm ${item.readAt ? 'border-edge' : 'border-brand ring-1 ring-brand-light'}`}>
              <div className="flex items-start gap-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.readAt ? 'bg-subtle text-muted' : 'bg-brand-light text-[var(--sw-brand)]'}`}>
                  {item.kind === 'announcement' ? <Bell size={17} /> : icon(item.channel)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <b className="text-sm text-content">{item.subject ?? eventLabel(item.eventType)}</b>
                    <time className="text-muted">{format(item.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-5 text-secondary">{item.body}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-muted">
                      {channelLabel(item.channel)} · {chineseDomainLabel(item.state)}
                    </span>
                    {item.readAt ? (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <Check size={13} />
                        已读
                      </span>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => void actions.acknowledge(item)} className="rounded-md bg-brand-light px-2.5 py-1.5 font-bold text-[var(--sw-brand)] disabled:opacity-50">
                        {busy === `notification:${item.id}` ? '保存中…' : '标记已读'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {notificationState === 'empty' ? <State kind="empty" text="暂无通知" /> : null}
          {notificationState === 'ready' && hasMore ? (
            <button type="button" disabled={loadingMore} onClick={() => void actions.loadMore()} className="w-full rounded-lg border border-edge bg-surface py-2.5 font-bold text-[var(--sw-brand)] disabled:opacity-50">
              {loadingMore ? '正在加载…' : '加载更早通知'}
            </button>
          ) : null}
        </div>
        <aside className="h-fit rounded-xl border border-edge bg-surface p-4 shadow-sm">
          <h2 className="text-base font-black text-content">消息偏好</h2>
          <p className="mt-1 text-muted">关闭后不影响交易处理；微信授权仅以微信端真实授权结果为准。</p>
          {preferenceState === 'loading' ? <State kind="loading" text="正在读取消息偏好…" compact /> : null}
          {preferenceState === 'failed' ? <State kind="failed" text={preferenceMessage ?? '消息偏好加载失败'} retry={() => void actions.retryPreferences()} compact /> : null}
          <div className="mt-4 divide-y">
            {preferenceState === 'ready'
              ? preferences.map((item) => {
                  const key = `preference:${item.channel}:${item.eventType}`;
                  return (
                    <div key={key} className="py-3">
                      <label className="flex cursor-pointer items-center justify-between gap-3">
                        <span>
                          <b className="block text-content">{eventLabel(item.eventType)}</b>
                          <span className="text-muted">
                            {channelLabel(item.channel)}
                            {item.channel === 'wechat' ? ` · ${authorizationLabel(item.authorization)}` : ''}
                          </span>
                        </span>
                        <input
                          aria-label={`${eventLabel(item.eventType)}${channelLabel(item.channel)}`}
                          type="checkbox"
                          checked={item.enabled}
                          aria-describedby={item.channel === 'wechat' && item.authorization !== 'accepted' ? `${key}:authorization` : undefined}
                          disabled={busy !== null}
                          onChange={(event) => void actions.toggle(item, event.target.checked)}
                          className="h-4 w-4 accent-[var(--sw-brand)]"
                        />
                      </label>
                      {item.channel === 'wechat' && item.authorization !== 'accepted' ? (
                        <p id={`${key}:authorization`} className="mt-1 text-warning-strong">
                          请先在微信端授权服务通知
                        </p>
                      ) : null}
                      <details className="mt-2 rounded-lg bg-subtle px-3 py-2 text-muted">
                        <summary className="cursor-pointer font-bold text-secondary">免打扰时段{item.quietStart && item.quietEnd ? ` · ${item.quietStart.slice(0, 5)}–${item.quietEnd.slice(0, 5)}` : ' · 未设置'}</summary>
                        <form
                          className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const data = new FormData(event.currentTarget);
                            void actions.quiet(item, formText(data, 'start'), formText(data, 'end'), true);
                          }}
                        >
                          <TimeField name="start" label="开始" value={item.quietStart?.slice(0, 5) ?? '22:00'} />
                          <TimeField name="end" label="结束" value={item.quietEnd?.slice(0, 5) ?? '07:00'} />
                          <button type="submit" disabled={busy !== null} className="rounded-md bg-surface px-2.5 py-2 font-bold text-[var(--sw-brand)] disabled:opacity-50">
                            保存
                          </button>
                        </form>
                        {item.quietStart ? (
                          <button type="button" disabled={busy !== null} onClick={() => void actions.quiet(item, '22:00', '07:00', false)} className="mt-2 font-bold text-danger-strong">
                            关闭免打扰
                          </button>
                        ) : null}
                      </details>
                    </div>
                  );
                })
              : null}
            {preferenceState === 'empty' ? <p className="py-6 text-center text-muted">商城尚未发布可配置的消息模板</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}

function TimeField({ name, label, value }: Readonly<{ name: string; label: string; value: string }>) {
  return (
    <label className="grid gap-1">
      <span>{label}</span>
      <input type="time" name={name} defaultValue={value} required className="min-w-0 rounded-md border border-edge bg-surface px-2 py-1.5 text-content" />
    </label>
  );
}

function State({ kind, text, retry, compact = false }: Readonly<{ kind: 'loading' | 'failed' | 'empty'; text: string; retry?: () => void; compact?: boolean }>) {
  return (
    <div role={kind === 'failed' ? 'alert' : 'status'} className={`grid place-items-center rounded-xl border border-dashed bg-surface text-muted ${compact ? 'mt-3 min-h-20' : 'min-h-32'}`}>
      <span className="inline-flex items-center gap-2">
        {kind === 'loading' ? <LoaderCircle size={17} className="animate-spin" /> : kind === 'failed' ? <CircleAlert size={17} /> : <Bell size={17} />}
        {text}
      </span>
      {kind === 'failed' && retry ? (
        <button type="button" onClick={retry} className="mt-2 rounded-md bg-brand-light px-3 py-1.5 font-bold text-[var(--sw-brand)]">
          重试
        </button>
      ) : null}
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
  return labels[value] ?? '账户通知';
}
function format(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
