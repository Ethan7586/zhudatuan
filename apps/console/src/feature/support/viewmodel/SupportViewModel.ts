import { chineseReference, hasFailureCode, queryCondition, safeQueryError } from '@shop/presentation';
import { OP_SUPPORT_ASSIGNMENTS_MANAGE, OP_SUPPORT_CASES_CLOSE, OP_SUPPORT_CASES_REOPEN, OP_SUPPORT_HISTORY_READ } from '@shop/contract/ids';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import type { SupportDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import type { HistoryItem } from '../model/History';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket, TicketPage } from '../model/Ticket';
import type { TicketFilter } from '../model/TicketFilter';
import { supportAccess } from '../model/SupportAccess';
import { useConversationViewModel } from './ConversationViewModel';
import { acceptSupportEvent, emptyEventLedger, reconcileQueue } from './SupportEventReducer';
import { agentsKey, directTicketKey, historyKey, queueKey, queuePrefix } from './SupportQueryKey';
import { useSettingsViewModel } from './SettingsViewModel';
import { readSupportFilter } from './SupportFilter';
import { supportActionError } from './SupportError';
import { executeTicketAction, type TicketAction } from './SupportAction';

export function useSupportViewModel(context: ConsoleContext, dependencies: SupportDependencies, requestStepup: () => void) {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useSearchParams();
  const cache = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [connected, setConnected] = useState(false);
  const deferredKeyword = useDeferredValue(keyword);
  const filter = useMemo(() => readSupportFilter(search, deferredKeyword), [deferredKeyword, search]);
  const path = scopeRoutePath(context.scope, 'consolesupport');
  const settingsOpen = search.get('view') === 'settings';
  const access = useMemo(() => supportAccess(context), [context]);
  const queue = useInfiniteQuery({
    queryKey: queueKey(context, filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => dependencies.readQueue.execute(context, { ...filter, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (page) => page.nextCursor,
    staleTime: 15_000,
  });
  const tickets = useMemo(() => {
    const values = new Map<string, Ticket>();
    for (const page of queue.data?.pages ?? []) for (const ticket of page.items) values.set(ticket.id, ticket);
    return Object.freeze([...values.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id)));
  }, [queue.data]);
  const direct = useQuery({
    queryKey: directTicketKey(context, caseId ?? 'unselected'),
    queryFn: ({ signal }) => dependencies.readQueue.execute(context, { limit: 1, keyword: caseId! }, signal),
    enabled: caseId !== undefined && !tickets.some((item) => item.id === caseId),
  });
  const ticket = tickets.find((item) => item.id === caseId) ?? direct.data?.items.find((item) => item.id === caseId);
  const refreshQueue = useCallback(() => queue.refetch(), [queue]);
  const conversation = useConversationViewModel(context, caseId, ticket, dependencies, refreshQueue, access.upload);
  const conversationEvent = conversation.onEvent;
  const activeQueuePrefix = useMemo(() => queuePrefix(context), [context]);
  const agents = useQuery({ queryKey: agentsKey(context), queryFn: ({ signal }) => dependencies.port.agents(context, undefined, signal), enabled: !settingsOpen && access.assignmentReady });
  const history = useInfiniteQuery({
    queryKey: historyKey(context, caseId ?? 'unselected'),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => dependencies.port.history(context, caseId!, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    enabled: historyOpen && caseId !== undefined && access.history,
  });
  const historyItems = useMemo<readonly HistoryItem[]>(() => history.data?.pages.flatMap((page) => page.items) ?? [], [history.data]);
  const settings = useSettingsViewModel(context, dependencies, settingsOpen);
  const conversationRefresh = conversation.actions.refresh;
  const queueRefetch = queue.refetch;
  const action = useMutation<void, Error, TicketAction>({
    mutationFn: (value) => executeTicketAction(context, dependencies, ticket, value),
    onSuccess: async () => {
      await queue.refetch();
    },
    onError: (cause) => {
      if (hasFailureCode(cause, 'VERSION_CONFLICT')) {
        void queue.refetch();
        if (caseId) void conversation.actions.refresh();
      }
    },
  });
  const ledger = useRef(emptyEventLedger());
  const receive = useCallback(
    (event: SupportEvent) => {
      const result = acceptSupportEvent(ledger.current, event);
      ledger.current = result.ledger;
      if (!result.accepted) return;
      setConnected(true);
      cache.setQueriesData<InfiniteData<TicketPage, string | undefined>>({ queryKey: activeQueuePrefix }, (current) => reconcileQueue(current, event, caseId));
      conversationEvent(event);
    },
    [activeQueuePrefix, cache, caseId, conversationEvent]
  );
  useEffect(() => {
    if (!access.realtime) {
      setConnected(false);
      return;
    }
    const controller = new AbortController();
    setConnected(true);
    const resync = () => {
      void queueRefetch();
      if (caseId) conversationRefresh();
    };
    void dependencies.port.listen(context, receive, resync, controller.signal).catch(() => {
      if (!controller.signal.aborted) setConnected(false);
    });
    return () => controller.abort();
  }, [access.realtime, caseId, context, conversationRefresh, dependencies.port, queueRefetch, receive]);
  const previousScope = useRef(context.scope.id);
  useEffect(() => {
    if (previousScope.current !== context.scope.id) {
      previousScope.current = context.scope.id;
      void navigate(path, { replace: true });
    }
    setKeyword('');
    setHistoryOpen(false);
    setContextOpen(false);
    ledger.current = emptyEventLedger();
  }, [context.scope.id, navigate, path]);
  const updateFilter = useCallback(
    <K extends keyof TicketFilter>(key: K, value: TicketFilter[K] | undefined) => {
      if (key === 'keyword') {
        setKeyword(typeof value === 'string' ? value : '');
        return;
      }
      const next = new URLSearchParams(search);
      next.delete('cursor');
      if (value === undefined || value === false || value === '') next.delete(key);
      else next.set(key, Array.isArray(value) ? value.join(',') : String(value));
      setSearch(next);
    },
    [search, setSearch]
  );
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => {
          void queue.refetch();
          if (caseId) conversation.actions.refresh();
        },
        settings: () => {
          if (settingsOpen || !access.settings) void navigate(path);
          else {
            const next = new URLSearchParams();
            next.set('view', 'settings');
            void navigate(`${path}?${next.toString()}`);
          }
        },
        filter: updateFilter,
        next: () => void queue.fetchNextPage(),
        retryQueue: () => void queue.refetch(),
        select: (id: string) => void navigate(scopeRoutePath(context.scope, 'consolesupportcase', { caseId: id })),
        order: (id: string) => {
          if (access.order) void navigate(scopeRoutePath(context.scope, 'consoleorderdetail', { orderId: id }));
        },
        back: () => void navigate(path),
        openContext: () => setContextOpen(true),
        closeContext: () => setContextOpen(false),
        closeTicket: () => {
          if (!access.close || action.isPending) return;
          if (!access.verify(OP_SUPPORT_CASES_CLOSE)) requestStepup();
          else action.mutate({ kind: 'close' });
        },
        reopenTicket: () => {
          if (!access.reopen || action.isPending) return;
          if (!access.verify(OP_SUPPORT_CASES_REOPEN)) requestStepup();
          else action.mutate({ kind: 'reopen' });
        },
        assign: (agent: string, reason: string) => {
          if (!access.assign || action.isPending) return;
          if (!access.verify(OP_SUPPORT_ASSIGNMENTS_MANAGE)) requestStepup();
          else action.mutate({ kind: 'assign', agent, reason });
        },
        openHistory: () => {
          if (!access.history) return;
          if (!access.verify(OP_SUPPORT_HISTORY_READ)) requestStepup();
          else setHistoryOpen(true);
        },
        verify: requestStepup,
        closeHistory: () => setHistoryOpen(false),
        nextHistory: () => void history.fetchNextPage(),
        retryHistory: () => void history.refetch(),
      }),
    [access, action, caseId, context.scope, conversation.actions, history, navigate, path, queue, requestStepup, settingsOpen, updateFilter]
  );
  return Object.freeze({
    scope: context.scope.name ?? chineseReference('组织范围', context.scope.id),
    settingsOpen,
    connected,
    access,
    path,
    selected: caseId,
    ticket,
    tickets,
    filter,
    queueCondition: queryCondition({ pending: queue.isPending, fetching: queue.isFetching, error: queue.error, hasData: queue.data !== undefined, empty: tickets.length === 0 }),
    queueError: safeQueryError(queue.error),
    queueNextCursor: queue.data?.pages.at(-1)?.nextCursor,
    conversation,
    contextOpen,
    agents: agents.data?.items ?? [],
    actionBusy: action.isPending,
    actionError: action.error ? supportActionError(action.error) : undefined,
    historyOpen,
    historyItems,
    historyCondition: queryCondition({ pending: history.isPending, fetching: history.isFetching, error: history.error, hasData: history.data !== undefined, empty: historyItems.length === 0 }),
    historyError: safeQueryError(history.error),
    historyNextCursor: history.data?.pages.at(-1)?.nextCursor,
    settings,
    actions,
  });
}
export type SupportViewModel = ReturnType<typeof useSupportViewModel>;
