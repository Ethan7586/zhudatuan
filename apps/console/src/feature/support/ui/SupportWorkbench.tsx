import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { ApiError } from '@shop/sdk/error';
import { useConsoleContext } from '../../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../../shared/presentation/QueryState';
import { scopePath } from '../../../shared/url/ScopePath';
import { AssignTicket } from '../application/AssignTicket';
import { CloseTicket } from '../application/CloseTicket';
import { conversationKey, ReadConversation } from '../application/ReadConversation';
import { queueKey, ReadQueue } from '../application/ReadQueue';
import { ReopenTicket } from '../application/ReopenTicket';
import { SendMessage, canSendMessage, type MessageDraft } from '../application/SendMessage';
import { UpdateReadState } from '../application/UpdateReadState';
import { UploadAttachment, type UploadedAttachment } from '../application/UploadAttachment';
import { SupportEventSource } from '../infrastructure/SupportEventSource';
import { SupportGateway, type SupportEvent } from '../infrastructure/SupportGateway';
import { mergeMessages } from '../infrastructure/SupportMapper';
import type { Ticket } from '../model/Ticket';
import type { TicketFilter } from '../model/TicketFilter';
import type { TicketPage } from '../model/Ticket';
import { HistoryPanel } from './HistoryPanel';
import { SupportContextPanel } from './SupportContextPanel';
import { SupportConversation } from './SupportConversation';
import { SupportHeader } from './SupportHeader';
import { SupportQueue } from './SupportQueue';
import { SupportSettings } from './SupportSettings';

const gateway = new SupportGateway();
const queueReader = new ReadQueue(gateway);
const conversationReader = new ReadConversation(gateway);
const messageSender = new SendMessage(gateway);
const attachmentUploader = new UploadAttachment(gateway);
const assignmentManager = new AssignTicket(gateway);
const ticketCloser = new CloseTicket(gateway);
const ticketReopener = new ReopenTicket(gateway);
const readUpdater = new UpdateReadState(gateway);
const eventSource = new SupportEventSource(gateway);
type TicketAction = Readonly<{ kind: 'close' }> | Readonly<{ kind: 'reopen' }> | Readonly<{ kind: 'assign'; agent: string; reason: string }>;

export function SupportWorkbench() {
  const context = useConsoleContext();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const cache = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword);
  const filter = useMemo<TicketFilter>(() => readFilter(search, deferredKeyword), [deferredKeyword, search]);
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [uploads, setUploads] = useState<Readonly<Record<string, readonly UploadedAttachment[]>>>({});
  const [failed, setFailed] = useState<Readonly<Record<string, MessageDraft>>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const lastRead = useRef<Readonly<Record<string, number>>>({});
  const previousScope = useRef(context.scope.id);
  const path = scopePath(context.scope, 'support');
  const settings = search.get('view') === 'settings';

  const queue = useInfiniteQuery({
    queryKey: queueKey(context, filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => queueReader.execute(context, { ...filter, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 15_000,
  });
  const tickets = useMemo(() => {
    const values = new Map<string, Ticket>();
    for (const page of queue.data?.pages ?? []) for (const ticket of page.items) values.set(ticket.id, ticket);
    return [...values.values()].sort((left, right) => right.updated_at.localeCompare(left.updated_at) || right.id.localeCompare(left.id));
  }, [queue.data]);
  const direct = useQuery({ queryKey: ['console', context.scope.id, 'support.ticket', caseId], queryFn: ({ signal }) => gateway.queue(context, { limit: 1, keyword: caseId! }, signal), enabled: caseId !== undefined && !tickets.some((item) => item.id === caseId) });
  const ticket = tickets.find((item) => item.id === caseId) ?? direct.data?.items.find((item) => item.id === caseId);
  const conversation = useInfiniteQuery({
    queryKey: conversationKey(context, caseId ?? 'unselected'),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => conversationReader.execute(context, caseId!, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    enabled: caseId !== undefined,
    staleTime: 10_000,
  });
  const messages = useMemo(() => mergeMessages(conversation.data?.pages ?? []), [conversation.data]);
  const latestConversation = conversation.data?.pages[0];
  const agents = useQuery({ queryKey: ['console', context.scope.id, context.session.accessVersion, 'support.agents'], queryFn: ({ signal }) => gateway.agents(context, undefined, signal) });
  const history = useInfiniteQuery({ queryKey: ['console', context.scope.id, caseId, 'support.history'], initialPageParam: undefined as string | undefined, queryFn: ({ pageParam, signal }) => gateway.history(context, caseId!, pageParam, signal), getNextPageParam: (page) => page.nextCursor, enabled: historyOpen && caseId !== undefined });
  const historyItems = useMemo(() => history.data?.pages.flatMap((page) => page.items) ?? [], [history.data]);

  const reconcile = useCallback((event: SupportEvent) => {
    const queuePrefix = ['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'support.queue'] as const;
    cache.setQueriesData<InfiniteData<TicketPage, string | undefined>>({ queryKey: queuePrefix }, (current) => current ? { ...current, pages: current.pages.map((page) => ({ ...page, items: page.items.map((item) => item.id === event.ticketId ? { ...item, updated_at: event.occurredAt, version: Math.max(item.version, event.version ?? item.version), unread_count: event.type === 'support.message.sent' && event.ticketId !== caseId ? item.unread_count + 1 : item.unread_count } : item) })) } : current);
    void cache.invalidateQueries({ queryKey: queuePrefix });
    if (event.ticketId === caseId) void cache.invalidateQueries({ queryKey: conversationKey(context, caseId) });
    if (event.evidenceId && (event.type === 'support.attachment.ready' || event.type === 'support.attachment.rejected')) {
      setUploads((current) => Object.fromEntries(Object.entries(current).map(([key, values]) => [key, values.map((item) => item.id === event.evidenceId ? { ...item, state: event.type === 'support.attachment.ready' ? 'clean' : 'rejected' } : item)])));
    }
  }, [cache, caseId, context]);
  useEffect(() => {
    const controller = new AbortController();
    setConnected(true);
    void eventSource.listen(context, reconcile, controller.signal).catch(() => { if (!controller.signal.aborted) { setConnected(false); void queue.refetch(); if (caseId) void conversation.refetch(); } });
    return () => controller.abort();
  }, [caseId, context.scope.id, context.session.accessVersion, reconcile]);
  useEffect(() => {
    if (previousScope.current !== context.scope.id) {
      cache.removeQueries({ queryKey: ['console', context.scope.kind, previousScope.current] });
      previousScope.current = context.scope.id;
      void navigate(path, { replace: true });
    }
    setKeyword(''); setDrafts({}); setUploads({}); setFailed({}); setHistoryOpen(false); setContextOpen(false); lastRead.current = {};
  }, [cache, context.scope.id, context.scope.kind, navigate, path]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (Object.values(drafts).some((value) => value.trim())) event.preventDefault(); };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [drafts]);

  const send = useMutation({
    mutationFn: (value: MessageDraft) => {
      if (!ticket) throw new Error('请先选择工单。');
      return messageSender.execute(context, ticket, value);
    },
    onSuccess: async (_, value) => {
      setDrafts((current) => ({ ...current, [value.ticketId]: '' })); setUploads((current) => ({ ...current, [value.ticketId]: [] })); setFailed((current) => without(current, value.ticketId));
      await Promise.all([cache.invalidateQueries({ queryKey: conversationKey(context, value.ticketId) }), queue.refetch()]);
    },
    onError: (_, value) => setFailed((current) => ({ ...current, [value.ticketId]: value })),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => { if (!caseId) throw new Error('请先选择工单。'); return attachmentUploader.execute(context, caseId, file); },
    onMutate: (file) => { if (caseId) setUploads((current) => ({ ...current, [caseId]: [...(current[caseId] ?? []), { id: `upload:${crypto.randomUUID()}`, name: file.name, state: 'uploading' }] })); },
    onSuccess: (value) => { if (caseId) setUploads((current) => ({ ...current, [caseId]: [...(current[caseId] ?? []).filter((item) => item.state !== 'uploading'), value] })); },
    onError: (cause) => { if (caseId) setUploads((current) => ({ ...current, [caseId]: (current[caseId] ?? []).map((item) => item.state === 'uploading' ? { ...item, state: 'failed', error: errorText(cause) } : item) })); },
  });
  const ticketAction = useMutation<void, Error, TicketAction>({
    mutationFn: async (action) => {
      if (!ticket) throw new Error('请先选择工单。');
      if (action.kind === 'close') await ticketCloser.execute(context, ticket);
      else if (action.kind === 'reopen') await ticketReopener.execute(context, ticket);
      else await assignmentManager.execute(context, ticket, action.agent, action.reason);
    },
    onSuccess: async () => { await queue.refetch(); },
    onError: (cause) => { if (cause instanceof ApiError && cause.code === 'VERSION_CONFLICT') { void queue.refetch(); if (caseId) void conversation.refetch(); } },
  });
  const updateFilter = <K extends keyof TicketFilter>(key: K, value: TicketFilter[K] | undefined) => {
    if (key === 'keyword') { setKeyword(typeof value === 'string' ? value : ''); return; }
    const next = new URLSearchParams(search); next.delete('cursor');
    if (value === undefined || value === false || value === '') next.delete(key); else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
    setSearch(next);
  };
  const read = useCallback((sequence: number) => {
    if (!ticket || sequence <= (lastRead.current[ticket.conversation_id] ?? latestConversation?.lastReadSequence ?? 0)) return;
    lastRead.current = { ...lastRead.current, [ticket.conversation_id]: sequence };
    void readUpdater.execute(context, ticket.conversation_id, sequence).catch(() => { lastRead.current = without(lastRead.current, ticket.conversation_id); });
  }, [context, latestConversation?.lastReadSequence, ticket]);
  const sendCurrent = () => {
    if (!caseId) return;
    const value = drafts[caseId] ?? '';
    const attachmentIds = (uploads[caseId] ?? []).filter((item) => item.state === 'clean').map((item) => item.id);
    send.mutate(messageSender.create(caseId, value, attachmentIds));
  };
  const unavailable = !ticket ? '请先选择一条工单' : canSendMessage(context, ticket) ? '' : ticket.state === 'closed' ? '工单已关闭，请先重新打开' : context.session.csrf === undefined ? '安全会话已过期，请重新登录' : '当前账号没有客服回复权限';
  return <section className="supportworkspace">
    <SupportHeader scope={context.scope.name ?? context.scope.id} settings={settings} connected={connected} onRefresh={() => { void queue.refetch(); if (caseId) void conversation.refetch(); }} onSettings={() => { if (settings) { void navigate(path); } else { const next = new URLSearchParams(); next.set('view', 'settings'); void navigate(`${path}?${next.toString()}`); } }} />
    {settings ? <SupportSettings gateway={gateway} /> : <>
    <div className="supportdesk" data-selected={ticket ? 'true' : 'false'} data-connected={connected}>
      <SupportQueue tickets={tickets} filter={filter} {...(caseId === undefined ? {} : { selected: caseId })} condition={queryCondition({ pending: queue.isPending, fetching: queue.isFetching, error: queue.error, hasData: queue.data !== undefined, empty: tickets.length === 0 })} {...(safeQueryError(queue.error) ? { error: safeQueryError(queue.error)! } : {})} {...(queue.hasNextPage && queue.data?.pages.at(-1)?.nextCursor ? { nextCursor: queue.data.pages.at(-1)!.nextCursor } : {})} path={path} onFilter={updateFilter} onNext={() => void queue.fetchNextPage()} onRetry={() => void queue.refetch()} />
      <SupportConversation {...(ticket === undefined ? {} : { ticket })} messages={messages} condition={caseId === undefined ? 'empty' : queryCondition({ pending: conversation.isPending, fetching: conversation.isFetching, error: conversation.error, hasData: conversation.data !== undefined, empty: messages.length === 0 })} {...(safeQueryError(conversation.error) ? { error: safeQueryError(conversation.error)! } : {})} {...(conversation.data?.pages.at(-1)?.nextCursor ? { nextCursor: conversation.data.pages.at(-1)!.nextCursor } : {})} backPath={path} draft={caseId ? drafts[caseId] ?? '' : ''} unavailable={unavailable} sending={send.isPending && send.variables?.ticketId === caseId} {...(send.isPending && send.variables?.ticketId === caseId ? { pending: send.variables } : {})} {...(caseId && failed[caseId] ? { failed: failed[caseId] } : {})} messageAttachments={latestConversation?.attachments ?? []} uploads={caseId ? uploads[caseId] ?? [] : []} onDraft={(value) => { if (caseId) setDrafts((current) => ({ ...current, [caseId]: value })); }} onSend={sendCurrent} onRetrySend={() => { if (caseId && failed[caseId]) send.mutate(failed[caseId]); }} onFile={(file) => upload.mutate(file)} onEarlier={() => void conversation.fetchNextPage()} onRetry={() => void conversation.refetch()} onRead={read} onContext={() => setContextOpen(true)} />
      <SupportContextPanel open={contextOpen} {...(ticket === undefined || latestConversation?.context === undefined ? {} : { ticket, context: latestConversation.context })} agents={agents.data?.items ?? []} busy={ticketAction.isPending} {...(safeQueryError(ticketAction.error) ? { error: conflictText(ticketAction.error) } : {})} onDismiss={() => setContextOpen(false)} onClose={() => ticketAction.mutate({ kind: 'close' })} onReopen={() => ticketAction.mutate({ kind: 'reopen' })} onAssign={(agent, reason) => ticketAction.mutate({ kind: 'assign', agent, reason })} onHistory={() => setHistoryOpen(true)} />
    </div>
    <HistoryPanel open={historyOpen} items={historyItems} condition={queryCondition({ pending: history.isPending, fetching: history.isFetching, error: history.error, hasData: history.data !== undefined, empty: historyItems.length === 0 })} {...(safeQueryError(history.error) ? { error: safeQueryError(history.error)! } : {})} {...(history.hasNextPage && history.data?.pages.at(-1)?.nextCursor ? { nextCursor: history.data.pages.at(-1)!.nextCursor } : {})} onClose={() => setHistoryOpen(false)} onNext={() => void history.fetchNextPage()} onRetry={() => void history.refetch()} />
    </>}
  </section>;
}

export { gateway as supportGateway };

function readFilter(search: URLSearchParams, keyword: string): TicketFilter {
  const ownership = search.get('ownership'); const state = search.get('states'); const priority = search.get('priorities'); const unread = search.get('unread');
  return { limit: 50, ownership: ownership === 'unassigned' || ownership === 'all' ? ownership : 'mine', ...(state === 'open' || state === 'assigned' || state === 'waiting' || state === 'resolved' || state === 'closed' ? { states: [state] } : {}), ...(priority === 'low' || priority === 'normal' || priority === 'high' || priority === 'urgent' ? { priorities: [priority] } : {}), ...(search.get('skill') ? { skill: search.get('skill')! } : {}), ...(search.get('agentId') ? { agentId: search.get('agentId')! } : {}), ...(unread === 'true' ? { unread: true } : {}), ...(search.get('updatedAfter') ? { updatedAfter: search.get('updatedAfter')! } : {}), ...(search.get('updatedBefore') ? { updatedBefore: search.get('updatedBefore')! } : {}), ...(keyword.trim() ? { keyword: keyword.trim() } : {}) };
}
function without<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> { const { [key]: _removed, ...remaining } = record; return remaining; }
function errorText(cause: unknown): string { return cause instanceof Error ? cause.message : '操作失败，请重试。'; }
function conflictText(cause: unknown): string { return cause instanceof ApiError && cause.code === 'VERSION_CONFLICT' ? '工单已被其他客服更新，已刷新最新状态；请确认后重新操作。' : errorText(cause); }
