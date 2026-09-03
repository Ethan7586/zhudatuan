import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { hasFailureCode, presentError } from '@shop/presentation';
import { ArrowLeft, CircleAlert, LoaderCircle, Paperclip, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../../shared/runtime/SessionContext';
import { conversationDrafts } from '../application/ConversationDraft';
import { readCase } from '../application/ReadCases';
import { ReadConversation } from '../application/ReadConversation';
import { SendMessage } from '../application/SendMessage';
import { UpdateReadState } from '../application/UpdateReadState';
import { UploadAttachment } from '../application/UploadAttachment';
import { SupportEventSource } from '../infrastructure/SupportEventSource';
import { supportGateway } from '../infrastructure/SupportGateway';
import { mergeConversations } from '../infrastructure/SupportMapper';
import type { PendingAttachment, SupportAttachment } from '../model/Attachment';
import type { Conversation, MessageDraft, SupportMessage } from '../model/Message';
import { SupportComposer } from './SupportComposer';
import './Support.css';

const reader = new ReadConversation();
const sender = new SendMessage();
const uploader = new UploadAttachment();
const readUpdater = new UpdateReadState();
const events = new SupportEventSource();
type Session = NonNullable<ReturnType<typeof useSession>['session']>;

export function ConversationPage({ caseId }: Readonly<{ caseId: string }>) {
  const runtime = useSession();
  const session = runtime.session;
  const navigate = useNavigate();
  const cache = useQueryClient();
  const scope = runtime.scope || 'guest';
  const ticketKey = useMemo(() => ['storefront', scope, 'support.ticket', caseId] as const, [caseId, scope]);
  const conversationKey = useMemo(() => ['storefront', scope, 'support.conversation', caseId] as const, [caseId, scope]);
  const [draft, setDraft] = useState(() => conversationDrafts.read(caseId));
  const [failed, setFailed] = useState<MessageDraft | null>(null);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [newMessage, setNewMessage] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const scroll = useRef({ caseId, first: 0, last: 0, height: 0, bottom: true });
  const lastRead = useRef(0);

  const ticket = useQuery({ queryKey: ticketKey, queryFn: ({ signal }) => readCase(required(session), caseId, signal), enabled: runtime.status === 'authenticated' });
  const conversation = useInfiniteQuery({
    queryKey: conversationKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => reader.execute(required(session), caseId, pageParam, signal),
    getNextPageParam: (page) => page.nextCursor,
    enabled: runtime.status === 'authenticated',
    staleTime: 10_000,
  });
  const merged = useMemo(() => mergeConversations(conversation.data?.pages ?? []), [conversation.data]);

  const updateDraft = useCallback((next: typeof draft) => { setDraft(next); conversationDrafts.write(caseId, next); }, [caseId]);
  useEffect(() => { const next = conversationDrafts.read(caseId); setDraft(next); setFailed(null); setNotice(''); lastRead.current = 0; }, [caseId]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (conversationDrafts.hasUnsent()) event.preventDefault(); };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, []);

  const refreshLatest = useCallback(async () => {
    if (!session) return;
    const latest = await reader.execute(session, caseId);
    cache.setQueryData<InfiniteData<Conversation, string | undefined>>(conversationKey, (current) => current ? { ...current, pages: [latest, ...current.pages.slice(1)] } : { pages: [latest], pageParams: [undefined] });
  }, [cache, caseId, conversationKey, session]);
  useEffect(() => {
    const conversationId = ticket.data?.conversationId;
    if (!session || !conversationId) return;
    const controller = new AbortController();
    setConnected(true);
    void events.listen(session, conversationId, (event) => {
      if (event.ticketId !== caseId) return;
      if (event.evidenceId && (event.type === 'support.attachment.ready' || event.type === 'support.attachment.rejected')) {
        const current = conversationDrafts.read(caseId);
        updateDraft({ ...current, attachments: current.attachments.map((item) => item.id === event.evidenceId ? { ...item, state: event.type === 'support.attachment.ready' ? 'clean' : 'rejected' } : item) });
      }
      if (event.type === 'support.message.sent' || event.type.startsWith('support.ticket.') || event.type.startsWith('support.attachment.')) {
        void refreshLatest(); void ticket.refetch();
      }
    }, controller.signal).catch(() => {
      if (!controller.signal.aborted) { setConnected(false); setNotice('实时连接正在恢复，已同步服务器最新状态。'); void refreshLatest(); void ticket.refetch(); }
    });
    return () => controller.abort();
  }, [caseId, refreshLatest, session, ticket.data?.conversationId, updateDraft]);

  const send = useMutation({
    mutationFn: (value: MessageDraft) => sender.execute(required(session), value),
    onSuccess: async (value, sent) => {
      conversationDrafts.clear(sent.caseId); setDraft({ message: '', attachments: [] }); setFailed(null); setNotice('');
      cache.setQueryData(ticketKey, (current: typeof ticket.data) => current ? { ...current, state: value.ticket.state, version: value.ticket.version } : current);
      await refreshLatest();
    },
    onError: async (cause, value) => {
      setFailed(value);
      if (hasFailureCode(cause, 'VERSION_CONFLICT')) { setNotice('工单状态刚刚发生变化，消息和附件已保留。请确认最新状态后原样重试。'); await Promise.all([ticket.refetch(), refreshLatest()]); }
      else setNotice(presentError(cause).message);
    },
  });
  const upload = useMutation({
    mutationFn: ({ file }: Readonly<{ file: File; localId: string }>) => uploader.execute(required(session), caseId, file),
    onMutate: ({ file, localId }) => updateDraft({ ...draft, attachments: [...draft.attachments, { id: localId, name: file.name, state: 'uploading' }] }),
    onSuccess: (value, input) => updateDraft({ ...conversationDrafts.read(caseId), attachments: conversationDrafts.read(caseId).attachments.map((item) => item.id === input.localId ? value : item) }),
    onError: (cause, input) => updateDraft({ ...conversationDrafts.read(caseId), attachments: conversationDrafts.read(caseId).attachments.map((item) => item.id === input.localId ? { ...item, state: 'failed', error: presentError(cause).message } : item) }),
  });

  const markRead = useCallback((sequence: number) => {
    const conversationId = ticket.data?.conversationId;
    if (!session || !conversationId || sequence <= Math.max(lastRead.current, merged.lastReadSequence)) return;
    lastRead.current = sequence;
    void readUpdater.execute(session, conversationId, sequence).catch(() => { lastRead.current = merged.lastReadSequence; });
  }, [merged.lastReadSequence, session, ticket.data?.conversationId]);
  useLayoutEffect(() => {
    const element = viewport.current; if (!element) return;
    const first = merged.items[0]?.sequence ?? 0; const last = merged.items.at(-1)?.sequence ?? 0; const previous = scroll.current;
    if (previous.caseId !== caseId) { element.scrollTop = element.scrollHeight; setNewMessage(false); }
    else if (previous.first && first < previous.first) element.scrollTop += element.scrollHeight - previous.height;
    else if (last > previous.last && previous.bottom) { element.scrollTop = element.scrollHeight; setNewMessage(false); }
    else if (last > previous.last) setNewMessage(true);
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    scroll.current = { caseId, first, last, height: element.scrollHeight, bottom };
    if (bottom && last) markRead(last);
  }, [caseId, markRead, merged.items]);

  const sendCurrent = () => {
    const current = ticket.data;
    if (!current) return;
    send.mutate(sender.create(caseId, current.version, draft.message, draft.attachments.filter((item) => item.state === 'clean').map((item) => item.id)));
  };
  const unavailable = !ticket.data ? '正在确认工单状态…' : ticket.data.state === 'closed' ? '工单已关闭，如需继续咨询请创建新工单' : !session?.csrfToken ? '登录会话已过期，请重新登录' : '';
  const error = notice || (ticket.data === null ? '找不到此工单，或您无权查看。' : ticket.error || conversation.error ? '会话加载失败，请检查网络后重试。' : '');
  return <main className="storesupportconversation">
    <header className="storesupportconversationheader"><button type="button" aria-label="返回客服中心" onClick={() => void navigate('/support')}><ArrowLeft size={18} /></button><div><p>SMART WING SERVICE</p><h1>{ticket.data?.subject ?? '工单会话'}</h1><span>{caseId} · {connected ? '实时连接正常' : '正在恢复实时连接'}</span></div><button type="button" aria-label="刷新会话" onClick={() => { void ticket.refetch(); void refreshLatest(); }}><RefreshCw size={17} /></button></header>
    {error ? <p className="storesupporterror" role="alert"><CircleAlert size={16} />{error}</p> : null}
    <section className="storesupportmessages" ref={viewport} aria-label="工单消息" onScroll={(event) => { const element = event.currentTarget; const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96; scroll.current = { ...scroll.current, height: element.scrollHeight, bottom }; if (bottom) { setNewMessage(false); markRead(merged.items.at(-1)?.sequence ?? 0); } }}>
      {conversation.hasNextPage ? <button className="storesupportearlier" type="button" disabled={conversation.isFetchingNextPage} onClick={() => void conversation.fetchNextPage()}>{conversation.isFetchingNextPage ? '加载中…' : '加载更早消息'}</button> : null}
      {conversation.isPending ? <p className="storesupportloading" role="status"><LoaderCircle size={18} />正在读取会话…</p> : null}
      {merged.items.map((message, index) => <MessageBubble key={message.id} message={message} attachments={merged.attachments.filter((item) => item.messageId === message.id)} showDate={index === 0 || day(message.createdAt) !== day(merged.items[index - 1]!.createdAt)} />)}
      {send.isPending && send.variables ? <DraftBubble draft={send.variables} state="sending" /> : failed ? <DraftBubble draft={failed} state="failed" /> : null}
      {newMessage ? <button className="storesupportnewmessage" type="button" onClick={() => { if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; setNewMessage(false); }}>有新消息</button> : null}
      {!conversation.isPending && merged.items.length === 0 ? <p className="storesupportempty">尚无消息</p> : null}
    </section>
    <SupportComposer value={draft.message} unavailable={unavailable} sending={send.isPending} failed={failed !== null} attachments={draft.attachments} onChange={(message) => updateDraft({ ...draft, message })} onSend={sendCurrent} onRetry={() => { if (failed) send.mutate(failed); }} onFile={(file) => upload.mutate({ file, localId: `upload:${crypto.randomUUID()}` })} />
  </main>;
}

function MessageBubble({ message, attachments, showDate }: Readonly<{ message: SupportMessage; attachments: readonly SupportAttachment[]; showDate: boolean }>) { return <>{showDate ? <div className="storesupportdate">{day(message.createdAt)}</div> : null}<article className="storesupportmessage" data-author={message.authorType}><div><strong>{message.authorType === 'member' ? '我' : '客服'}</strong><time dateTime={message.createdAt}>{format(message.createdAt)}</time></div><p>{message.body}</p>{attachments.length ? <ul>{attachments.map((item) => <li key={item.id}><Paperclip size={14} />{item.download ? <a href={item.download.url} rel="noreferrer">{item.name}</a> : <span>{item.name}</span>}<em>{item.state === 'clean' ? '已通过安全检查' : item.state === 'pending' ? '安全扫描中' : '已拒绝'}</em></li>)}</ul> : null}<small>已发送 · #{message.sequence}</small></article></>; }
function DraftBubble({ draft, state }: Readonly<{ draft: MessageDraft; state: 'sending' | 'failed' }>) { return <article className="storesupportmessage" data-author="member" data-delivery={state}><div><strong>我</strong></div><p>{draft.message}</p><small>{state === 'sending' ? '正在发送…' : '发送失败，可原样重试'}</small></article>; }
function required(value: Session | null): Session { if (!value) throw new Error('AUTHENTICATION_REQUIRED'); return value; }
function day(value: string): string { return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value)); }
function format(value: string): string { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
