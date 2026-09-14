import { ResourceState, type ResourceCondition } from '@shop/design';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { SupportCase } from './SupportSchema';
import {
  shortIdentifier,
  supportChannelLabel,
  supportPriorityLabel,
  supportStateLabel,
  supportTime,
  supportTone,
} from './SupportPresentation';

interface SupportCaseRailProps {
  readonly canCreate: boolean;
  readonly cases: readonly SupportCase[];
  readonly condition: ResourceCondition;
  readonly count: number;
  readonly createUnavailableReason: string;
  readonly creating: boolean;
  readonly error?: string;
  readonly nextCursor?: string;
  readonly onCreate: () => void;
  readonly onNext: (cursor: string) => void;
  readonly onRetry: () => void;
  readonly selectedCaseId?: string;
  readonly queueSearch: string;
  readonly supportPath: string;
}

export function SupportCaseRail(props: SupportCaseRailProps) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('all');
  const stateOptions = useMemo(() => [...new Set(props.cases.map((item) => item.state))], [props.cases]);
  const visibleCases = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    return props.cases.filter((item) => {
      const matchesState = state === 'all' || item.state === state;
      const haystack = `${item.subject} ${item.id} ${item.order_id ?? ''} ${item.channel}`.toLocaleLowerCase('zh-CN');
      return matchesState && (keyword.length === 0 || haystack.includes(keyword));
    });
  }, [props.cases, query, state]);

  return (
    <aside className="supportcaserail" aria-label="服务工单队列" data-condition={props.condition}>
      <div className="supportcasefilters">
        <label>
          <span className="sr-only">搜索当前页工单</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索工单标题、订单号或编号" autoComplete="off" />
        </label>
        <label>
          <span className="sr-only">筛选工单状态</span>
          <select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="all">全部状态</option>
            {stateOptions.map((value) => <option key={value} value={value}>{supportStateLabel(value)}</option>)}
          </select>
        </label>
        <button className="supportcasecreate" type="button" aria-label={props.creating ? '关闭新建工单' : '新建工单'}
          aria-pressed={props.creating} disabled={!props.canCreate && !props.creating}
          title={props.canCreate || props.creating ? (props.creating ? '关闭新建工单' : '新建工单') : props.createUnavailableReason}
          onClick={props.onCreate}><NewConversationIcon /></button>
      </div>
      <div className="supportcasepagehint">搜索与状态筛选仅作用于当前页 {props.cases.length} 条工单</div>
      <div className="supportcaseviewport">
        {isQueueError(props.condition) ? <SupportQueueError onRetry={props.onRetry}
          {...(props.error === undefined ? {} : { error: props.error })} /> :
          <ResourceState condition={props.condition} {...(props.error === undefined ? {} : { error: props.error })} retry={props.onRetry}>
            {visibleCases.length === 0 ? <div className="supportlocalempty"><strong>没有匹配的工单</strong><span>换个关键词或状态试试。</span></div> :
              <nav className="supportcaselist" aria-label="服务工单">
                {visibleCases.map((item) => <SupportCaseLink key={item.id} item={item} selected={item.id === props.selectedCaseId}
                  queueSearch={props.queueSearch} supportPath={props.supportPath} />)}
              </nav>}
          </ResourceState>}
      </div>
      {props.nextCursor === undefined ? null : <div className="supportcasepagination">
        <button type="button" onClick={() => props.onNext(props.nextCursor!)}>读取下一页工单</button>
      </div>}
    </aside>
  );
}

function NewConversationIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5.25 5.75h13.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H10l-4.75 2.5v-2.5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z" />
    <path d="M12 9v6M9 12h6" />
  </svg>;
}

function isQueueError(condition: ResourceCondition): boolean {
  return condition === 'notfound' || condition === 'conflict' || condition === 'ratelimited'
    || condition === 'offline' || condition === 'failure';
}

function SupportQueueError({ error, onRetry }: Readonly<{ error?: string; onRetry: () => void }>) {
  const requestId = error?.match(/请求\s+([A-Za-z0-9-]+)/)?.[1];
  const unavailable = error?.includes('NOT_FOUND') ?? false;
  return <section className="supportqueueerror" role="alert">
    <span className="supportqueueerroricon" aria-hidden="true">!</span>
    <div><strong>{unavailable ? '工单服务暂未接通' : '暂时无法读取工单'}</strong>
      <p>{unavailable ? '当前商城暂时没有可读取的工单资源。' : '请稍后重试，已有页面内容不会受到影响。'}</p>
      {requestId === undefined ? null : <small>请求 {requestId}</small>}
    </div>
    <button type="button" onClick={onRetry}>重新加载</button>
  </section>;
}

function SupportCaseLink({ item, selected, queueSearch, supportPath }: Readonly<{
  item: SupportCase;
  selected: boolean;
  queueSearch: string;
  supportPath: string;
}>) {
  return (
    <Link to={{ pathname: `${supportPath}/${encodeURIComponent(item.id)}`, search: queueSearch }}
      aria-current={selected ? 'page' : undefined}>
      <span className="supportcasecopy">
        <span className="supportcaseidentity">发起人</span>
        <span className="supportcasetopline"><strong>{item.subject}</strong></span>
        <span className="supportcasepreview">{supportChannelLabel(item.channel)}工单 · 暂无最近内容摘要</span>
        <span className="supportcasefacts"><span>#{shortIdentifier(item.id)}</span><time dateTime={item.updated_at}>{supportTime(item.updated_at)}</time></span>
        <span className="supportcasebadges">
          <em data-tone={supportTone(item.priority)}>{supportPriorityLabel(item.priority)}优先级</em>
          <em data-tone={supportTone(item.state)}>{supportStateLabel(item.state)}</em>
        </span>
      </span>
    </Link>
  );
}
