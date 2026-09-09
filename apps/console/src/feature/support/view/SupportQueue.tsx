import { Button, ResourceState, type ResourceCondition } from '@shop/design';
import { channelLabel, formatTime, priorityLabel, shortId, stateLabel, tone } from './SupportPresentation';
import type { Agent } from '../model/Agent';
import type { Ticket } from '../model/Ticket';
import type { TicketFilter } from '../model/TicketFilter';
import { SupportFilters } from './SupportFilters';

export function SupportQueue({
  tickets,
  agents,
  filter,
  selected,
  condition,
  error,
  nextCursor,
  onSelect,
  onFilter,
  onNext,
  onRetry,
  onReset,
}: Readonly<{
  tickets: readonly Ticket[];
  agents: readonly Agent[];
  filter: TicketFilter;
  selected?: string;
  condition: ResourceCondition;
  error?: string | undefined;
  nextCursor?: string | undefined;
  onFilter: <K extends keyof TicketFilter>(key: K, value: TicketFilter[K] | undefined) => void;
  onNext: () => void;
  onRetry: () => void;
  onReset: () => void;
  onSelect: (ticket: string) => void;
}>) {
  return (
    <aside className="supportqueue" aria-label="客服工单队列">
      <header className="supportpanelheader">
        <div>
          <strong>工单队列</strong>
          <span>{tickets.length}</span>
        </div>
      </header>
      <div className="supportownership" role="group" aria-label="队列归属">
        {(['mine', 'unassigned', 'all'] as const).map((value) => (
          <button key={value} type="button" aria-pressed={(filter.ownership ?? 'mine') === value} onClick={() => onFilter('ownership', value)}>
            {value === 'mine' ? '我的' : value === 'unassigned' ? '未分配' : '全部'}
          </button>
        ))}
      </div>
      <SupportFilters filter={filter} agents={agents} onFilter={onFilter} onReset={onReset} />
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
