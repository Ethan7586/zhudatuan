import type { TicketFilter } from '../model/TicketFilter';

export function readSupportFilter(search: URLSearchParams, keyword: string): TicketFilter {
  const ownership = search.get('ownership');
  const state = search.get('states');
  const priority = search.get('priorities');
  return {
    limit: 50,
    ownership: ownership === 'unassigned' || ownership === 'all' ? ownership : 'mine',
    ...(state === 'open' || state === 'assigned' || state === 'waiting' || state === 'resolved' || state === 'closed' ? { states: [state] } : {}),
    ...(priority === 'low' || priority === 'normal' || priority === 'high' || priority === 'urgent' ? { priorities: [priority] } : {}),
    ...(search.get('skill') ? { skill: search.get('skill')! } : {}),
    ...(search.get('agentId') ? { agentId: search.get('agentId')! } : {}),
    ...(search.get('unread') === 'true' ? { unread: true } : {}),
    ...(search.get('updatedAfter') ? { updatedAfter: search.get('updatedAfter')! } : {}),
    ...(search.get('updatedBefore') ? { updatedBefore: search.get('updatedBefore')! } : {}),
    ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
  };
}
