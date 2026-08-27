import { useId, type ReactNode } from 'react';
import { ResourceState, type ResourceCondition } from './ResourceState';

export interface ResourcePanelProps {
  readonly title: string;
  readonly description?: string;
  readonly condition: ResourceCondition;
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly actions?: ReactNode;
  readonly error?: string;
  readonly retry?: () => void;
}

const sourceLabels: Record<ResourceCondition, string> = {
  loading: '正在同步',
  empty: '实时数据',
  ready: '实时数据',
  refreshing: '正在刷新',
  stale: '数据已过期',
<<<<<<< HEAD
  unauthenticated: '登录失效',
  denied: '没有权限',
=======
  denied: '访问受限',
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  notfound: '资源不存在',
  conflict: '数据冲突',
  ratelimited: '请求受限',
  offline: '网络不可用',
  failure: '数据不可用',
  retry: '正在重试',
};

export function ResourcePanel({ title, description, condition, children, eyebrow, actions, error, retry }: ResourcePanelProps) {
  const titleId = useId();
<<<<<<< HEAD
  const accessBlocked = condition === 'unauthenticated' || condition === 'denied';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
  return (
    <section className="resourcepanel" aria-labelledby={titleId}>
      <header className="resourceheading">
        <div>
          {eyebrow === undefined ? null : <p className="eyebrow">{eyebrow}</p>}
          <h1 id={titleId}>{title}</h1>
          {description === undefined ? null : <p>{description}</p>}
        </div>
        <span className={`datasource datasource-${condition}`}>
          <i aria-hidden="true" />
          {sourceLabels[condition]}
        </span>
      </header>
<<<<<<< HEAD
      {actions === undefined || accessBlocked ? null : (
        <div className="resourceactions" role="group" aria-label={`${title}操作`}>
          {actions}
        </div>
      )}
      <ResourceState condition={condition} resourceLabel={title} {...(error === undefined ? {} : { error })} {...(retry === undefined ? {} : { retry })}>
=======
      {actions === undefined ? null : <div className="resourceactions" role="group" aria-label={`${title}操作`}>{actions}</div>}
      <ResourceState condition={condition} {...(error === undefined ? {} : { error })} {...(retry === undefined ? {} : { retry })}>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        {children}
      </ResourceState>
    </section>
  );
}
