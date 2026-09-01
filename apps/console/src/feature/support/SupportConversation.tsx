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
          <Link className="supportmobileback" to={props.backPath} aria-label="返回客服工单队列">‹</Link>
          <span className="supportconversationavatar" aria-hidden="true">客</span>
          <div><h2 id="supportconversationtitle">{title}</h2>
            <p>{props.selectedCase === undefined ? '正在显示此工单的会话记录' : `${supportChannelLabel(props.selectedCase.channel)} · ${shortIdentifier(props.caseId)}`}</p>
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
          <header><strong>{supportAuthorLabel(message.authorType, message.author)}</strong>
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
      <div className="supportcomposerbar">
        <button type="button" disabled title="附件上传尚未接入" aria-label="添加附件（尚未接入）">＋</button>
        <span>Enter 发送 · Shift + Enter 换行</span>
        <small>{draft.length}/4000</small>
      </div>
      <textarea value={draft} maxLength={4000} rows={3} disabled={!canSend || sending}
        onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown}
        placeholder={canSend ? '输入回复内容…' : unavailableReason} aria-label="回复内容" />
      <div className="supportcomposeractions">
        <span role="status" aria-live="polite">{sending ? '正在安全发送…' : sendError ?? (!canSend ? unavailableReason : '')}</span>
        <button type="submit" disabled={!canSend || sending || draft.trim().length === 0}>{sending ? '发送中' : '发送回复'}</button>
      </div>
    </form>
  );
}

function ConversationWelcome() {
  return (
    <section className="supportconversation supportconversationwelcome" aria-labelledby="supportconversationtitle">
      <span className="supportwelcomeicon" aria-hidden="true">主</span>
      <p>ZHUDATUAN SUPPORT</p>
      <h2 id="supportconversationtitle">选择一条工单开始处理</h2>
      <span>从左侧会话队列打开工单，这里会展示经服务端解密的真实消息记录。</span>
    </section>
  );
}
