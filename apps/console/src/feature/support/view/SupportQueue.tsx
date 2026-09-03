import { Button, ResourceState, type ResourceCondition } from '@shop/design';
import { channelLabel, formatTime, priorityLabel, shortId, stateLabel, tone } from './SupportPresentation';
import type { Ticket } from '../model/Ticket';
import type { TicketFilter } from '../model/TicketFilter';

export function SupportQueue({
  tickets,
  filter,
  selected,
  condition,
  error,
  nextCursor,
  onSelect,
  onFilter,
  onNext,
  onRetry,
}: Readonly<{
  tickets: readonly Ticket[];
  filter: TicketFilter;
  selected?: string;
  condition: ResourceCondition;
  error?: string | undefined;
  nextCursor?: string | undefined;
  onFilter: <K extends keyof TicketFilter>(key: K, value: TicketFilter[K] | undefined) => void;
  onNext: () => void;
  onRetry: () => void;
  onSelect: (ticket: string) => void;
}>) {
  return (
    <aside className="supportqueue" aria-label="客服工单队列">
      <header className="supportpanelheader">
        <div>
          <strong>工单队列</strong>
          <span>{tickets.length}</span>
        </div>
        <Button onPress={onRetry} aria-label="刷新工单队列">
          ↻
        </Button>
      </header>
      <div className="supportownership" role="group" aria-label="队列归属">
        {(['mine', 'unassigned', 'all'] as const).map((value) => (
          <button key={value} type="button" aria-pressed={(filter.ownership ?? 'mine') === value} onClick={() => onFilter('ownership', value)}>
            {value === 'mine' ? '我的' : value === 'unassigned' ? '未分配' : '全部'}
          </button>
        ))}
      </div>
      <div className="supportfilters">
        <label className="supportsearch">
          <span className="sr-only">搜索工单</span>
          <input type="search" value={text(filter.keyword)} onChange={(event) => onFilter('keyword', event.target.value || undefined)} placeholder="姓名、手机号、工号或工单号" autoComplete="off" />
        </label>
        <label>
          <span>状态</span>
          <select value={first(filter.states)} onChange={(event) => onFilter('states', event.target.value ? [event.target.value as Ticket['state']] : undefined)}>
            <option value="">全部</option>
            <option value="open">待处理</option>
            <option value="assigned">处理中</option>
            <option value="waiting">等待用户</option>
            <option value="resolved">已解决</option>
            <option value="closed">已关闭</option>
          </select>
        </label>
        <label>
          <span>优先级</span>
          <select value={first(filter.priorities)} onChange={(event) => onFilter('priorities', event.target.value ? [event.target.value as Ticket['priority']] : undefined)}>
            <option value="">全部</option>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          <span>技能</span>
          <input value={text(filter.skill)} onChange={(event) => onFilter('skill', event.target.value || undefined)} placeholder="技能组" />
        </label>
        <label>
          <span>客服编号</span>
          <input value={text(filter.agentId)} onChange={(event) => onFilter('agentId', event.target.value || undefined)} placeholder="输入客服编号" />
        </label>
        <label>
          <span>开始时间</span>
          <input type="datetime-local" value={text(filter.updatedAfter)} onChange={(event) => onFilter('updatedAfter', event.target.value || undefined)} />
        </label>
        <label>
          <span>结束时间</span>
          <input type="datetime-local" value={text(filter.updatedBefore)} onChange={(event) => onFilter('updatedBefore', event.target.value || undefined)} />
        </label>
        <label className="supportunread">
          <input type="checkbox" checked={filter.unread === true || filter.unread === 'true'} onChange={(event) => onFilter('unread', event.target.checked ? true : undefined)} />
          只看未读
        </label>
      </div>
      <div className="supportqueueviewport">
        <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={onRetry}>
          <nav className="supportticketlist" aria-label="客服工单">
            {tickets.map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => onSelect(ticket.id)} aria-current={ticket.id === selected ? 'page' : undefined}>
                <span className="supportticketavatar" data-tone={tone(ticket.priority)}>
                  {ticket.subject.trim().slice(0, 1) || '工'}
                </span>
                <span className="supportticketcopy">
                  <span>
                    <strong>{ticket.subject}</strong>
                    <time dateTime={ticket.updatedAt}>{formatTime(ticket.updatedAt)}</time>
                  </span>
                  <small>
                    {channelLabel(ticket.channel)} · {shortId(ticket.id)}
                  </small>
                  <span className="supportticketbadges">
                    {ticket.unreadCount > 0 ? <em data-tone="danger">{ticket.unreadCount} 条未读</em> : null}
                    <em data-tone={tone(ticket.priority)}>{priorityLabel(ticket.priority)}</em>
                    <em data-tone={tone(ticket.state)}>{stateLabel(ticket.state)}</em>
                    {ticket.slaRisk !== 'normal' ? <em data-tone="danger">{ticket.slaRisk === 'overdue' ? '服务时限已超时' : '服务时限临近'}</em> : null}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </ResourceState>
      </div>
      {nextCursor ? (
        <footer className="supportqueuefooter">
          <Button onPress={onNext}>加载更多工单</Button>
        </footer>
      ) : null}
    </aside>
  );
}

function text(value: TicketFilter[keyof TicketFilter]): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
function first(value: TicketFilter[keyof TicketFilter]): string {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : '';
}
