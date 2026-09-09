import { chineseDomainLabel } from '@shop/presentation';
import type { Agent } from '../model/Agent';
import type { Ticket } from '../model/Ticket';
import { advancedTicketFilterCount, type TicketFilter } from '../model/TicketFilter';

export function SupportFilters({
  filter,
  agents,
  onFilter,
  onReset,
}: Readonly<{
  filter: TicketFilter;
  agents: readonly Agent[];
  onFilter: <K extends keyof TicketFilter>(key: K, value: TicketFilter[K] | undefined) => void;
  onReset: () => void;
}>) {
  const count = advancedTicketFilterCount(filter);
  const skills = [...new Set(['general', ...agents.flatMap(({ skills: values }) => values), ...(filter.skill ? [filter.skill] : [])])];
  const selectedAgentMissing = typeof filter.agentId === 'string' && !agents.some(({ id }) => id === filter.agentId);
  return (
    <div className="supportfilterstack">
      <label className="supportsearch">
        <span>搜索</span>
        <input
          aria-label="搜索工单"
          type="search"
          value={text(filter.keyword)}
          onChange={(event) => onFilter('keyword', event.target.value || undefined)}
          placeholder="姓名、手机号、工号或工单号"
          autoComplete="off"
        />
      </label>
      <div className="supportfilterprimary">
        <label>
          <span>状态</span>
          <select value={first(filter.states)} onChange={(event) => onFilter('states', event.target.value ? [event.target.value as Ticket['state']] : undefined)}>
            <option value="">全部状态</option>
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
            <option value="">全部级别</option>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="normal">普通</option>
            <option value="low">低</option>
          </select>
        </label>
      </div>
      <details className="supportadvanced" open={count > 0 ? true : undefined}>
        <summary>
          <span>更多筛选</span>
          {count > 0 ? <em>{count} 项已启用</em> : <small>技能、客服、时间、未读</small>}
          <b aria-hidden="true">⌄</b>
        </summary>
        <div className="supportadvancedbody">
          <label>
            <span>服务技能</span>
            <select value={text(filter.skill)} onChange={(event) => onFilter('skill', event.target.value || undefined)}>
              <option value="">全部技能</option>
              {skills.map((skill) => (
                <option key={skill} value={skill}>
                  {chineseDomainLabel(skill, '专属服务')}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>负责客服</span>
            <select value={text(filter.agentId)} onChange={(event) => onFilter('agentId', event.target.value || undefined)}>
              <option value="">全部客服</option>
              {selectedAgentMissing ? <option value={filter.agentId}>已选客服（姓名不可用）</option> : null}
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>更新开始时间</span>
            <input type="datetime-local" value={text(filter.updatedAfter)} onChange={(event) => onFilter('updatedAfter', event.target.value || undefined)} />
          </label>
          <label>
            <span>更新结束时间</span>
            <input type="datetime-local" value={text(filter.updatedBefore)} onChange={(event) => onFilter('updatedBefore', event.target.value || undefined)} />
          </label>
          <label className="supportunread">
            <input type="checkbox" checked={filter.unread === true || filter.unread === 'true'} onChange={(event) => onFilter('unread', event.target.checked ? true : undefined)} />
            <i aria-hidden="true" />
            <span className="supportunreadcopy">
              <strong>只看未读</strong>
              <small>优先处理等待回复的工单</small>
            </span>
          </label>
          <button className="supportfilterreset" type="button" onClick={onReset} disabled={count === 0}>
            清除更多筛选
          </button>
        </div>
      </details>
    </div>
  );
}

function text(value: TicketFilter[keyof TicketFilter]): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function first(value: TicketFilter[keyof TicketFilter]): string {
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : '';
}
