import { useId, type ReactNode } from 'react';
import { ResourceState, type ResourceCondition } from './ResourceState';
import { SectionBoundary } from './SectionBoundary';

export interface ResourcePanelProps {
  readonly title: string;
  readonly description?: string;
  readonly condition: ResourceCondition;
  readonly children: ReactNode;
  readonly eyebrow?: string;
  readonly actions?: ReactNode;
  readonly notice?: ReactNode;
  readonly error?: string;
  readonly retry?: () => void;
  readonly headingLevel?: 1 | 2;
}

const sourceLabels: Record<ResourceCondition, string> = {
  loading: '正在同步',
  empty: '实时数据',
  ready: '实时数据',
  refreshing: '正在刷新',
  stale: '数据已过期',
  forbidden: '访问受限',
  unavailable: '依赖不可用',
  notconfigured: '尚未配置',
  notfound: '资源不存在',
  conflict: '数据冲突',
  ratelimited: '请求受限',
  offline: '网络不可用',
  failure: '数据不可用',
  retry: '正在重试',
};

export function ResourcePanel({ title, description, condition, children, eyebrow, actions, notice, error, retry, headingLevel = 1 }: ResourcePanelProps) {
  const titleId = useId();
  return (
    <section className="resourcepanel" aria-labelledby={titleId}>
      <header className="resourceheading">
        <div>
          {eyebrow === undefined ? null : <p className="eyebrow">{eyebrow}</p>}
          {headingLevel === 1 ? <h1 id={titleId}>{title}</h1> : <h2 id={titleId}>{title}</h2>}
          {description === undefined ? null : <p>{description}</p>}
        </div>
        <span className={`datasource datasource-${condition}`}>
          <i aria-hidden="true" />
          {sourceLabels[condition]}
        </span>
      </header>
      {actions === undefined ? null : (
        <div className="resourceactions" role="group" aria-label={`${title}操作`}>
          {actions}
        </div>
      )}
      {notice}
      <SectionBoundary title={`${title}暂时无法显示`} resetKey={condition}>
        <ResourceState condition={condition} {...(error === undefined ? {} : { error })} {...(retry === undefined ? {} : { retry })}>
          {children}
        </ResourceState>
      </SectionBoundary>
    </section>
  );
}
