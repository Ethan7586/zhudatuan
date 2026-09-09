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
  readonly cases: readonly SupportCase[];
  readonly condition: ResourceCondition;
  readonly count: number;
  readonly error?: string;
  readonly nextCursor?: string;
  readonly onNext: (cursor: string) => void;
  readonly onRetry: () => void;
  readonly selectedCaseId?: string;
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
    <aside className="supportcaserail" aria-label="服务工单队列">
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
        <button type="button" onClick={props.onRetry} aria-label="刷新工单队列" title="刷新工单队列">↻</button>
      </div>
      <div className="supportcasepagehint">搜索与状态筛选仅作用于当前页 {props.cases.length} 条工单</div>
      <div className="supportcaseviewport">
        <ResourceState condition={props.condition} {...(props.error === undefined ? {} : { error: props.error })} retry={props.onRetry}>
          {visibleCases.length === 0 ? <div className="supportlocalempty"><strong>没有匹配的工单</strong><span>换个关键词或状态试试。</span></div> :
            <nav className="supportcaselist" aria-label="服务工单">
              {visibleCases.map((item) => <SupportCaseLink key={item.id} item={item} selected={item.id === props.selectedCaseId}
                supportPath={props.supportPath} />)}
            </nav>}
        </ResourceState>
      </div>
      {props.nextCursor === undefined ? null : <div className="supportcasepagination">
        <button type="button" onClick={() => props.onNext(props.nextCursor!)}>读取下一页工单</button>
      </div>}
    </aside>
  );
}

function SupportCaseLink({ item, selected, supportPath }: Readonly<{
  item: SupportCase;
  selected: boolean;
  supportPath: string;
}>) {
  return (
    <Link to={`${supportPath}/${encodeURIComponent(item.id)}`} aria-current={selected ? 'page' : undefined}>
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
