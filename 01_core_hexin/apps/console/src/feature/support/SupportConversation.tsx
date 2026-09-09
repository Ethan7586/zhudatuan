import { ResourceState, type ResourceCondition } from '@shop/design';
import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SupportCase, SupportMessage } from './SupportSchema';
import {
  shortIdentifier,
  supportAuthorInitial,
  supportAuthorLabel,
  supportChannelLabel,
  supportStateLabel,
  supportTime,
  supportTone,
} from './SupportPresentation';

interface SupportConversationProps {
  readonly canSend: boolean;
  readonly backPath: string;
  readonly caseId?: string;
  readonly condition: ResourceCondition;
  readonly error?: string;
  readonly messages: readonly SupportMessage[];
  readonly nextCursor?: string;
  readonly onNext: (cursor: string) => void;
  readonly onRetry: () => void;
  readonly onSend: (message: string) => Promise<void>;
  readonly selectedCase?: SupportCase;
  readonly sendError?: string;
  readonly sending: boolean;
  readonly sendUnavailableReason: string;
}

export function SupportConversation(props: SupportConversationProps) {
  const viewport = useRef<HTMLDivElement>(null);
  const position = useRef<{ caseId: string | undefined; first: string | undefined; last: string | undefined;
    height: number; nearBottom: boolean }>({ caseId: undefined, first: undefined, last: undefined, height: 0, nearBottom: true });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || (props.condition !== 'ready' && props.condition !== 'refreshing')) return;
    const current = position.current;
    const first = props.messages[0]?.id;
    const last = props.messages.at(-1)?.id;
    if (current.caseId !== props.caseId) element.scrollTop = element.scrollHeight;
    else if (current.first !== undefined && first !== current.first) element.scrollTop += element.scrollHeight - current.height;
    else if (current.nearBottom && current.last !== last) element.scrollTop = element.scrollHeight;
    position.current = { caseId: props.caseId, first, last, height: element.scrollHeight,
      nearBottom: element.scrollHeight - element.scrollTop - element.clientHeight < 80 };
  }, [props.caseId, props.condition, props.messages]);
  const rememberPosition = () => {
    const element = viewport.current;
    if (!element) return;
    position.current = { ...position.current, height: element.scrollHeight,
      nearBottom: element.scrollHeight - element.scrollTop - element.clientHeight < 80 };
  };

  if (props.caseId === undefined) return <ConversationWelcome />;
  const title = props.selectedCase?.subject ?? `工单 ${shortIdentifier(props.caseId)}`;
  return (
    <section className="supportconversation" aria-labelledby="supportconversationtitle">
      <header className="supportconversationheader">
        <div>
          <Link className="supportmobileback" to={props.backPath} aria-label="返回服务工单队列">‹</Link>
          <span className="supportconversationidentity">发起人</span>
          <div><h2 id="supportconversationtitle">{title}</h2>
            <p>{props.selectedCase === undefined ? '正在显示此工单的会话记录' : `#${shortIdentifier(props.caseId)} · ${supportChannelLabel(props.selectedCase.channel)}`}</p>
          </div>
        </div>
        <div className="supportconversationtools">
          {props.selectedCase === undefined ? null : <span data-tone={supportTone(props.selectedCase.state)}>{supportStateLabel(props.selectedCase.state)}</span>}
          <button type="button" onClick={props.onRetry} aria-label="刷新当前会话" title="刷新当前会话">↻</button>
        </div>
      </header>
      <div className="supportmessages" ref={viewport} onScroll={rememberPosition}>
        {props.nextCursor === undefined ? null : <button className="supportloadmessages" type="button"
          onClick={() => props.onNext(props.nextCursor!)}>加载更早消息</button>}
        {props.condition === 'empty' ? <div className="supportconversationempty"><strong>这段会话还没有消息</strong><span>具备发送权限的坐席可以发出第一条回复。</span></div> :
          <ResourceState condition={props.condition} {...(props.error === undefined ? {} : { error: props.error })} retry={props.onRetry}>
            <div className="supportmessagelog" role="log" aria-live="polite" aria-label="工单消息">
              {props.messages.map((message, index) => <MessageBubble key={message.id} message={message}
                showDate={index === 0 || day(message.createdAt) !== day(props.messages[index - 1]!.createdAt)} />)}
            </div>
          </ResourceState>}
      </div>
      <SupportComposer canSend={props.canSend} sending={props.sending}
        {...(props.sendError === undefined ? {} : { sendError: props.sendError })}
        unavailableReason={props.sendUnavailableReason} onSend={props.onSend} />
    </section>
  );
}

function MessageBubble({ message, showDate }: Readonly<{ message: SupportMessage; showDate: boolean }>) {
  const agent = message.authorType.toLowerCase() === 'agent';
  return (
    <>{showDate ? <div className="supportmessagedate" role="separator">{day(message.createdAt)}</div> : null}
      <article className="supportmessage" data-author={agent ? 'agent' : 'customer'}>
        <span className="supportmessageavatar" aria-hidden="true">{supportAuthorInitial(message.authorType)}</span>
        <div>
          <header><strong>{supportAuthorLabel(message.authorType)}</strong>
            <time dateTime={message.createdAt}>{supportTime(message.createdAt)}</time></header>
          <p>{message.body}</p>
        </div>
      </article></>
  );
}

function day(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(parsed);
}

function SupportComposer({ canSend, sending, sendError, unavailableReason, onSend }: Readonly<{
  canSend: boolean;
  sending: boolean;
  sendError?: string;
  unavailableReason: string;
  onSend: (message: string) => Promise<void>;
}>) {
  const [draft, setDraft] = useState('');
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend || sending || draft.trim().length === 0) return;
    try {
      await onSend(draft);
      setDraft('');
    } catch {
      // Mutation state renders the safe user-facing failure below.
    }
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };
  return (
    <form className="supportcomposer" onSubmit={(event) => { void submit(event); }}>
      <div className="supportcomposermodes" role="tablist" aria-label="消息类型">
        <button type="button" role="tab" aria-selected="true">回复消费者</button>
        <button type="button" role="tab" aria-selected="false" disabled title="下一批接入">内部备注</button>
        <button type="button" role="tab" aria-selected="false" disabled title="下一批接入">协同供应商</button>
      </div>
      <div className="supportcomposerbox">
        <textarea value={draft} maxLength={4000} rows={4} disabled={!canSend || sending}
          onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown}
          placeholder={canSend ? '请输入回复内容…' : unavailableReason} aria-label="回复内容" />
        <div className="supportcomposeractions">
          <div className="supportcomposerattachments" aria-label="尚未接入的消息附件">
            <button type="button" disabled title="下一批接入" aria-label="添加附件（下一批接入）">⌕</button>
            <button type="button" disabled title="下一批接入" aria-label="添加图片（下一批接入）">▧</button>
            <button type="button" disabled title="下一批接入" aria-label="添加文件（下一批接入）">▤</button>
          </div>
          <span role="status" aria-live="polite">{sending ? '发送中…' : sendError ?? (!canSend ? unavailableReason : `${draft.length}/4000`)}</span>
          <button type="submit" disabled={!canSend || sending || draft.trim().length === 0}>{sending ? '发送中' : '发送回复'}</button>
        </div>
      </div>
    </form>
  );
}

function ConversationWelcome() {
  return (
    <section className="supportconversation supportconversationwelcome" aria-labelledby="supportconversationtitle">
      <span className="supportwelcomeicon" aria-hidden="true"><SupportMark /></span>
      <p>服务中心</p>
      <h2 id="supportconversationtitle">选择一条工单开始处理</h2>
      <span>从左侧队列打开工单，查看完整沟通记录与处理信息。</span>
    </section>
  );
}

function SupportMark() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.25 11.25c0 4.06-3.69 7.1-8.25 7.1-1.04 0-2.04-.16-2.94-.46L4.8 20.1l1.1-4.04a6.55 6.55 0 0 1-2.15-4.81c0-4.06 3.69-7.1 8.25-7.1s8.25 3.04 8.25 7.1Z" />
    <path d="m8.65 11.3 2.18 2.05 4.72-4.55" />
  </svg>;
}

export function SupportApprovalCard({ title, amount, description, state = '待审批' }: Readonly<{
  title: string;
  amount: string;
  description: string;
  state?: string;
}>) {
  return <article className="supportapprovalcard" aria-label={title}>
    <header><strong>{title}</strong><span>{state}</span></header>
    <dl><div><dt>金额</dt><dd>{amount}</dd></div><div><dt>申请说明</dt><dd>{description}</dd></div></dl>
    <div><button type="button" disabled title="下一批接入">批准</button><button type="button" disabled title="下一批接入">驳回</button>
      <button type="button" disabled title="下一批接入">要求补充</button></div>
  </article>;
}
