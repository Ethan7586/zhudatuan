import type { ReactNode } from 'react';
import { Empty } from './Empty';
import { ContextualAccessDenied } from './AccessDenied';
import { ErrorView } from './Error';

export const resourceConditions = ['loading', 'empty', 'ready', 'refreshing', 'stale', 'unauthenticated', 'denied', 'notfound', 'conflict', 'ratelimited', 'offline', 'failure', 'retry'] as const;

export type ResourceCondition = (typeof resourceConditions)[number];

export interface ResourceStateProps {
  readonly condition: ResourceCondition;
  readonly error?: string;
  readonly retry?: () => void;
  readonly resourceLabel?: string;
  readonly children: ReactNode;
}

export function resourceCondition(data: unknown, rowCount: number, error?: string): ResourceCondition {
  if (error !== undefined) return 'failure';
  if (data === undefined) return 'loading';
  return rowCount === 0 ? 'empty' : 'ready';
}

export function ResourceState({ condition, error, retry, resourceLabel, children }: ResourceStateProps) {
  if (condition === 'ready') return children;
  if (condition === 'loading')
    return (
      <p role="status" aria-live="polite">
        正在加载…
      </p>
    );
  if (condition === 'empty') return <Empty title="暂无数据" description="当前范围内没有符合条件的记录。" />;
  if (condition === 'refreshing') return <BusyState label="正在刷新最新数据…">{children}</BusyState>;
  if (condition === 'retry') return <BusyState label="正在重试…">{children}</BusyState>;
  if (condition === 'stale') {
    return (
      <StateWithContent title="数据可能已过期" message={error ?? '当前展示的是最近一次成功读取的数据。'} {...(retry === undefined ? {} : { retry })}>
        {children}
      </StateWithContent>
    );
  }
  const message = error ?? 'UNKNOWN_RESOURCE_ERROR';
  if (condition === 'unauthenticated') return <ContextualAccessDenied kind="unauthenticated" {...(resourceLabel === undefined ? {} : { resourceLabel })} />;
  if (condition === 'denied') return <ContextualAccessDenied {...(resourceLabel === undefined ? {} : { resourceLabel })} />;
  if (condition === 'notfound') return <ErrorView title="资源不存在" message={message} />;
  if (condition === 'conflict') return <ErrorView title="数据已被其他操作更新" message={message} {...(retry === undefined ? {} : { retry })} />;
  if (condition === 'ratelimited') return <ErrorView title="请求过于频繁" message={message} {...(retry === undefined ? {} : { retry })} />;
  if (condition === 'offline') return <ErrorView title="网络不可用" message={message} {...(retry === undefined ? {} : { retry })} />;
  return <ErrorView message={message} {...(retry === undefined ? {} : { retry })} />;
}

function BusyState({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="resourcestatebusy" aria-busy="true">
      <p className="sr-only" role="status" aria-live="polite">
        {label}
      </p>
      {children}
    </div>
  );
}

function StateWithContent({
  title,
  message,
  retry,
  children,
}: Readonly<{
  title: string;
  message: string;
  retry?: () => void;
  children: ReactNode;
}>) {
  return (
    <div className="resourcestatestale">
      <section role="status">
        <h2>{title}</h2>
        <p>{message}</p>
        {retry === undefined ? null : (
          <button className="shopbutton shopbuttondefault" type="button" onClick={retry}>
            刷新
          </button>
        )}
      </section>
      {children}
    </div>
  );
}
