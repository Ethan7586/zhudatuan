import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { requireSession } from '../../../entity/session';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ROUTES } from '../../../generated/RouteBinding';
import { conversationDrafts, type ConversationDraftState } from '../application/ConversationDraft';
import { ReadCases } from '../application/ReadCases';
import { ReadConversation } from '../application/ReadConversation';
import { SendMessage } from '../application/SendMessage';
import { UpdateReadState } from '../application/UpdateReadState';
import { UploadAttachment } from '../application/UploadAttachment';
import { ListenSupportEvents } from '../application/ListenSupportEvents';
import { mergeConversations } from '../model/ConversationMerge';
import type { Conversation, MessageDraft } from '../model/Message';
import { initialSupportEventState, reduceSupportEvent } from './SupportEventReducer';
import { reconnectDelay } from './ReconnectDelay';

export function useConversationViewModel(caseId: string) {
  const dependencies = useDependencies();
  const runtime = useSession();
  const session = runtime.session;
  const navigate = useNavigate();
  const cache = useQueryClient();
  const scope = runtime.scope || 'guest';
  const reader = useRef(new ReadConversation(dependencies.support));
  const cases = useRef(new ReadCases(dependencies.support));
  const sender = useRef(new SendMessage(dependencies.support));
  const uploader = useRef(new UploadAttachment(dependencies.support));
  const readUpdater = useRef(new UpdateReadState(dependencies.support));
  const events = useRef(new ListenSupportEvents(dependencies.support));
  const ticketKey = useMemo(() => ['storefront', scope, 'support.ticket', caseId] as const, [caseId, scope]);
  const conversationKey = useMemo(() => ['storefront', scope, 'support.conversation', caseId] as const, [caseId, scope]);
  const [draft, setDraft] = useState(() => conversationDrafts.read(caseId));
  const [failed, setFailed] = useState<MessageDraft | null>(null);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [newMessage, setNewMessage] = useState(false);
  const lastRead = useRef(0);
  const eventState = useRef(initialSupportEventState);

  const ticket = useQuery({
    queryKey: ticketKey,
    queryFn: ({ signal }) => cases.current.detail(requireSession(session), caseId, signal),
    enabled: runtime.status === 'authenticated' && Boolean(caseId),
  });
  const conversation = useInfiniteQuery({
    queryKey: conversationKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => reader.current.execute(requireSession(session), caseId, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    enabled: runtime.status === 'authenticated' && Boolean(caseId),
    staleTime: 10_000,
  });
  const merged = useMemo(() => mergeConversations(conversation.data?.pages ?? []), [conversation.data]);

  const updateDraft = useCallback(
    (next: ConversationDraftState) => {
      setDraft(next);
      conversationDrafts.write(caseId, next);
    },
    [caseId]
  );

  const refreshTicket = ticket.refetch;
  useEffect(() => {
    setDraft(conversationDrafts.read(caseId));
    setFailed(null);
    setNotice('');
    setNewMessage(false);
    lastRead.current = 0;
    eventState.current = initialSupportEventState;
  }, [caseId]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (conversationDrafts.hasUnsent()) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);

  const refreshLatest = useCallback(async () => {
    if (!session) return;
    const latest = await reader.current.execute(session, caseId);
    cache.setQueryData<InfiniteData<Conversation, string | undefined>>(conversationKey, (current) => (current ? { ...current, pages: [latest, ...current.pages.slice(1)] } : { pages: [latest], pageParams: [undefined] }));
  }, [cache, caseId, conversationKey, session]);

  useEffect(() => {
    const conversationId = ticket.data?.conversationId;
    if (!session || !conversationId) return;
    const controller = new AbortController();
    let reconnect = 0;
    const listen = async () => {
      while (!controller.signal.aborted) {
        try {
          setConnected(true);
          await events.current.execute(
            session,
            conversationId,
            (event) => {
              const decision = reduceSupportEvent(eventState.current, event);
              eventState.current = decision.state;
              if (!decision.accepted || event.ticketId !== caseId) return;
              if (event.evidenceId && (event.type === 'support.attachment.ready' || event.type === 'support.attachment.rejected')) {
                const current = conversationDrafts.read(caseId);
                updateDraft({ ...current, attachments: current.attachments.map((item) => (item.id === event.evidenceId ? { ...item, state: event.type === 'support.attachment.ready' ? 'clean' : 'rejected' } : item)) });
              }
              void Promise.all([refreshLatest(), refreshTicket()]);
            },
            controller.signal,
            eventState.current.cursor
          );
          reconnect = 0;
        } catch {
          if (controller.signal.aborted) break;
          setConnected(false);
          setNotice('实时连接正在恢复，已同步服务器最新状态。');
          await Promise.allSettled([refreshLatest(), refreshTicket()]);
          await reconnectDelay(Math.min(5_000, 500 * 2 ** reconnect), controller.signal);
          reconnect += 1;
        }
      }
    };
    void listen();
    return () => controller.abort();
  }, [caseId, refreshLatest, refreshTicket, session, ticket.data?.conversationId, updateDraft]);

  const send = useMutation({
    mutationFn: (value: MessageDraft) => sender.current.execute(requireSession(session), value),
    onSuccess: async (value, sent) => {
      conversationDrafts.clear(sent.caseId);
      setDraft({ message: '', attachments: [] });
      setFailed(null);
      setNotice('');
      cache.setQueryData(ticketKey, (current: typeof ticket.data) => (current ? { ...current, state: value.ticket.state, version: value.ticket.version } : current));
      await refreshLatest();
    },
    onError: async (cause, value) => {
      setFailed(value);
      if (hasFailureCode(cause, 'VERSION_CONFLICT')) {
        setNotice('工单状态刚刚发生变化，消息和附件已保留。请确认最新状态后原样重试。');
        await Promise.all([ticket.refetch(), refreshLatest()]);
      } else setNotice(presentError(cause).message);
    },
  });
  const upload = useMutation({
    mutationFn: ({ file }: Readonly<{ file: File; localId: string }>) => uploader.current.execute(requireSession(session), caseId, file),
    onMutate: ({ file, localId }) => updateDraft({ ...conversationDrafts.read(caseId), attachments: [...conversationDrafts.read(caseId).attachments, { id: localId, name: file.name, state: 'uploading' }] }),
    onSuccess: (value, input) => updateDraft({ ...conversationDrafts.read(caseId), attachments: conversationDrafts.read(caseId).attachments.map((item) => (item.id === input.localId ? value : item)) }),
    onError: (cause, input) =>
      updateDraft({ ...conversationDrafts.read(caseId), attachments: conversationDrafts.read(caseId).attachments.map((item) => (item.id === input.localId ? { ...item, state: 'failed', error: presentError(cause).message } : item)) }),
  });

  const markRead = useCallback(
    (sequence: number) => {
      const conversationId = ticket.data?.conversationId;
      if (!session || !conversationId || sequence <= Math.max(lastRead.current, merged.lastReadSequence)) return;
      lastRead.current = sequence;
      void readUpdater.current.execute(session, conversationId, sequence).catch(() => {
        lastRead.current = merged.lastReadSequence;
      });
    },
    [merged.lastReadSequence, session, ticket.data?.conversationId]
  );

  const sendCurrent = () => {
    const current = ticket.data;
    if (!current || send.isPending) return;
    send.mutate(
      sender.current.create(
        caseId,
        current.version,
        draft.message,
        draft.attachments.filter((item) => item.state === 'clean').map((item) => item.id)
      )
    );
  };
  const unavailable = !ticket.data ? '正在确认工单状态…' : ticket.data.state === 'closed' ? '工单已关闭，如需继续咨询请创建新工单' : !session?.csrfToken ? '登录会话已过期，请重新登录' : '';
  const error = notice || (ticket.data === null ? '找不到此工单，或您无权查看。' : ticket.error || conversation.error ? '会话加载失败，请检查网络后重试。' : '');

  return Object.freeze({
    caseId,
    ticket: ticket.data ?? null,
    connected,
    error,
    state: conversation.isPending ? ('loading' as const) : conversation.isError ? ('failed' as const) : merged.items.length ? ('ready' as const) : ('empty' as const),
    messages: merged.items,
    attachments: merged.attachments,
    hasEarlier: Boolean(conversation.hasNextPage),
    loadingEarlier: conversation.isFetchingNextPage,
    draft,
    failed,
    sending: send.isPending,
    sendingDraft: send.variables ?? null,
    unavailable,
    newMessage,
    actions: Object.freeze({
      back: () => void navigate(ROUTES.storesupport),
      refresh: () => void Promise.all([ticket.refetch(), refreshLatest()]),
      loadEarlier: () => void conversation.fetchNextPage(),
      markRead,
      setNewMessage,
      changeMessage: (message: string) => updateDraft({ ...conversationDrafts.read(caseId), message }),
      send: sendCurrent,
      retry: () => {
        if (failed && !send.isPending) send.mutate(failed);
      },
      upload: (file: File) => {
        if (!upload.isPending) upload.mutate({ file, localId: `upload:${crypto.randomUUID()}` });
      },
    }),
  });
}
