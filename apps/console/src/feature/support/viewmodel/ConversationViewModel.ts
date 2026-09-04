import { queryCondition, presentError, safeQueryError } from '@shop/presentation';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canSendMessage } from '../application/SendMessage';
import { mergeMessages, type MessageDraft, type UploadedAttachment } from '../model/Message';
import type { SupportEvent } from '../model/SupportEvent';
import type { Ticket } from '../model/Ticket';
import { reconcileUploads } from './SupportEventReducer';
import { conversationKey } from './SupportQueryKey';

export function useConversationViewModel(context: ConsoleContext, ticketId: string | undefined, ticket: Ticket | undefined, dependencies: SupportDependencies, refreshQueue: () => Promise<unknown>) {
  const cache = useQueryClient();
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [uploads, setUploads] = useState<Readonly<Record<string, readonly UploadedAttachment[]>>>({});
  const [failed, setFailed] = useState<Readonly<Record<string, MessageDraft>>>({});
  const lastRead = useRef<Readonly<Record<string, number>>>({});
  useEffect(() => {
    setDrafts({});
    setUploads({});
    setFailed({});
    lastRead.current = {};
  }, [context.scope.kind, context.scope.id, context.session.accessVersion]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (Object.values(drafts).some((value) => value.trim())) event.preventDefault();
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [drafts]);
  const query = useInfiniteQuery({
    queryKey: conversationKey(context, ticketId ?? 'unselected'),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => dependencies.readConversation.execute(context, ticketId!, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    enabled: ticketId !== undefined,
    staleTime: 10_000,
  });
  const messages = useMemo(() => mergeMessages(query.data?.pages ?? []), [query.data]);
  const latest = query.data?.pages[0];
  const send = useMutation({
    mutationFn: (value: MessageDraft) => {
      if (!ticket) throw new Error('请先选择工单。');
      return dependencies.sendMessage.execute(context, ticket, value);
    },
    onSuccess: async (_, value) => {
      setDrafts((current) => ({ ...current, [value.ticketId]: '' }));
      setUploads((current) => ({ ...current, [value.ticketId]: [] }));
      setFailed((current) => without(current, value.ticketId));
      await Promise.all([cache.invalidateQueries({ queryKey: conversationKey(context, value.ticketId) }), refreshQueue()]);
    },
    onError: (_, value) => setFailed((current) => ({ ...current, [value.ticketId]: value })),
  });
  const upload = useMutation<UploadedAttachment, Error, File, Readonly<{ ticket: string; temporary: string }>>({
    mutationFn: (file) => dependencies.uploadAttachment.execute(context, ticketId!, file),
    onMutate: (file) => {
      if (!ticketId) throw new Error('请先选择工单。');
      const temporary = `upload:${crypto.randomUUID()}`;
      setUploads((current) => ({ ...current, [ticketId]: [...(current[ticketId] ?? []), { id: temporary, name: file.name, state: 'uploading' }] }));
      return Object.freeze({ ticket: ticketId, temporary });
    },
    onSuccess: (value, _, marker) => setUploads((current) => ({ ...current, [marker.ticket]: (current[marker.ticket] ?? []).map((item) => (item.id === marker.temporary ? value : item)) })),
    onError: (cause, _, marker) => {
      if (marker) setUploads((current) => ({ ...current, [marker.ticket]: (current[marker.ticket] ?? []).map((item) => (item.id === marker.temporary ? { ...item, state: 'failed', error: presentError(cause).message } : item)) }));
    },
  });
  const read = useCallback(
    (sequence: number) => {
      if (!ticket || sequence <= (lastRead.current[ticket.conversationId] ?? latest?.lastReadSequence ?? 0)) return;
      lastRead.current = { ...lastRead.current, [ticket.conversationId]: sequence };
      void dependencies.updateReadState.execute(context, ticket.conversationId, sequence).catch(() => {
        lastRead.current = without(lastRead.current, ticket.conversationId);
      });
    },
    [context, dependencies.updateReadState, latest?.lastReadSequence, ticket]
  );
  const sendCurrent = useCallback(() => {
    if (!ticketId || send.isPending) return;
    const value = drafts[ticketId] ?? '';
    const attachmentIds = (uploads[ticketId] ?? []).filter((item) => item.state === 'clean').map((item) => item.id);
    send.mutate(dependencies.sendMessage.create(ticketId, value, attachmentIds));
  }, [dependencies.sendMessage, drafts, send, ticketId, uploads]);
  const retrySend = useCallback(() => {
    if (ticketId && failed[ticketId] && !send.isPending) send.mutate(failed[ticketId]);
  }, [failed, send, ticketId]);
  const onEvent = useCallback(
    (event: SupportEvent) => {
      if (event.evidenceId) setUploads((current) => Object.freeze(Object.fromEntries(Object.entries(current).map(([key, values]) => [key, reconcileUploads(values, event)]))));
      if (event.ticketId === ticketId && (event.type === 'support.message.sent' || event.type === 'support.readstate.updated')) {
        void cache.invalidateQueries({ queryKey: conversationKey(context, ticketId) });
      }
    },
    [cache, context, ticketId]
  );
  const unavailable = !ticket
    ? '请先选择一条工单'
    : canSendMessage(context, ticket)
      ? ''
      : ticket.state === 'closed'
        ? '工单已关闭，请先重新打开'
        : context.session.csrf === undefined
          ? '安全会话已过期，请重新登录'
          : '当前账号没有客服回复权限';

  const actions = useMemo(
    () =>
      Object.freeze({
        draft: (value: string) => {
          if (ticketId) setDrafts((current) => ({ ...current, [ticketId]: value }));
        },
        send: sendCurrent,
        retrySend,
        file: (file: File) => {
          if (ticketId && !upload.isPending) upload.mutate(file);
        },
        earlier: () => void query.fetchNextPage(),
        refresh: () => void query.refetch(),
        read,
      }),
    [query, read, retrySend, sendCurrent, ticketId, upload]
  );

  return Object.freeze({
    messages,
    condition: ticketId === undefined ? ('empty' as const) : queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: messages.length === 0 }),
    error: safeQueryError(query.error),
    nextCursor: query.data?.pages.at(-1)?.nextCursor,
    draft: ticketId ? (drafts[ticketId] ?? '') : '',
    unavailable,
    sending: send.isPending && send.variables?.ticketId === ticketId,
    pending: send.isPending && send.variables?.ticketId === ticketId ? send.variables : undefined,
    failed: ticketId ? failed[ticketId] : undefined,
    messageAttachments: latest?.attachments ?? [],
    context: latest?.context,
    uploads: ticketId ? (uploads[ticketId] ?? []) : [],
    actions,
    onEvent,
  });
}

function without<T>(record: Readonly<Record<string, T>>, key: string): Readonly<Record<string, T>> {
  const { [key]: removed, ...remaining } = record;
  void removed;
  return remaining;
}
