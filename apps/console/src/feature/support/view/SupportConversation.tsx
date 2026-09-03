import { Button, ResourceState, type ResourceCondition } from '@shop/design';
import { useLayoutEffect, useRef, useState } from 'react';
import { authorLabel, formatTime, shortId, stateLabel, tone } from './SupportPresentation';
import type { Attachment, Message, MessageDraft, UploadedAttachment } from '../model/Message';
import type { Ticket } from '../model/Ticket';
import { SupportComposer } from './SupportComposer';

export function SupportConversation({
  ticket,
  messages,
  condition,
  error,
  nextCursor,
  onBack,
  draft,
  unavailable,
  sending,
  pending,
  failed,
  messageAttachments,
  uploads,
  onDraft,
  onSend,
  onRetrySend,
  onFile,
  onEarlier,
  onRetry,
  onRead,
  onContext,
}: Readonly<{
  ticket?: Ticket | undefined;
  messages: readonly Message[];
  condition: ResourceCondition;
  error?: string | undefined;
  nextCursor?: string | undefined;
  draft: string;
  unavailable: string;
  sending: boolean;
  pending?: MessageDraft | undefined;
  failed?: MessageDraft | undefined;
  messageAttachments: readonly Attachment[];
  uploads: readonly UploadedAttachment[];
  onDraft: (value: string) => void;
  onSend: () => void;
  onRetrySend: () => void;
  onFile: (file: File) => void;
  onEarlier: () => void;
  onRetry: () => void;
  onRead: (sequence: number) => void;
  onContext: () => void;
  onBack: () => void;
}>) {
  const viewport = useRef<HTMLDivElement>(null);
  const snapshot = useRef({ ticket: '', first: 0, last: 0, height: 0, nearBottom: true });
  const [newMessage, setNewMessage] = useState(false);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element || !ticket) return;
    const previous = snapshot.current;
    const first = messages[0]?.sequence ?? 0;
    const last = messages.at(-1)?.sequence ?? 0;
    if (previous.ticket !== ticket.id) {
      element.scrollTop = element.scrollHeight;
      setNewMessage(false);
    } else if (previous.first && first < previous.first) {
      element.scrollTop += element.scrollHeight - previous.height;
    } else if (last > previous.last) {
      if (previous.nearBottom) {
        element.scrollTop = element.scrollHeight;
        setNewMessage(false);
      } else setNewMessage(true);
    }
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    snapshot.current = { ticket: ticket.id, first, last, height: element.scrollHeight, nearBottom };
    if (nearBottom && last) onRead(last);
  }, [messages, onRead, ticket]);
  if (!ticket)
    return (
      <section className="supportconversation supportwelcome">
        <span aria-hidden="true">翼</span>
        <p>智慧翼 · 客服工作台</p>
        <h2>选择一条工单开始处理</h2>
        <small>从左侧队列打开工单，会话正文只从客服服务安全读取。</small>
      </section>
    );
  const onScroll = () => {
    const element = viewport.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    snapshot.current = { ...snapshot.current, height: element.scrollHeight, nearBottom };
    if (nearBottom) {
      setNewMessage(false);
      const sequence = messages.at(-1)?.sequence;
      if (sequence) onRead(sequence);
    }
  };
  const jump = () => {
    if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
    setNewMessage(false);
  };
  return (
    <section className="supportconversation" aria-labelledby="supportConversationTitle">
      <header className="supportconversationheader">
        <div>
          <button type="button" className="supportmobileback" onClick={onBack} aria-label="返回工单队列">
            ‹
          </button>
          <span className="supportconversationavatar">客</span>
          <div>
            <h2 id="supportConversationTitle">{ticket.subject}</h2>
            <p>
              {shortId(ticket.id)} · 第 {ticket.version} 版
            </p>
          </div>
        </div>
        <div>
          <span data-tone={tone(ticket.state)}>{stateLabel(ticket.state)}</span>
          <Button className="supportcontexttoggle" onPress={onContext}>
            用户信息
          </Button>
          <Button onPress={onRetry} aria-label="刷新当前会话">
            ↻
          </Button>
        </div>
      </header>
      <div className="supportmessageviewport" ref={viewport} onScroll={onScroll}>
        {nextCursor ? (
          <Button className="supportloadmore" onPress={onEarlier}>
            加载更早消息
          </Button>
        ) : null}
        <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={onRetry}>
          <div className="supportmessagelog" role="log" aria-live="polite">
            {messages.map((message, index) => (
              <MessageBubble key={message.id} message={message} attachments={messageAttachments.filter((item) => item.messageId === message.id)} date={index === 0 || day(message.createdAt) !== day(messages[index - 1]!.createdAt)} />
            ))}
            {pending ? <DraftBubble draft={pending} state="sending" /> : failed ? <DraftBubble draft={failed} state="failed" /> : null}
          </div>
        </ResourceState>
        {newMessage ? (
          <Button className="supportnewmessage" tone="primary" onPress={jump}>
            有新消息
          </Button>
        ) : null}
      </div>
      <SupportComposer draft={draft} unavailable={unavailable} sending={sending} {...(failed === undefined ? {} : { failed })} attachments={uploads} onDraft={onDraft} onSend={onSend} onRetry={onRetrySend} onFile={onFile} />
    </section>
  );
}

function MessageBubble({ message, attachments, date }: Readonly<{ message: Message; attachments: readonly Attachment[]; date: boolean }>) {
  return (
    <>
      {date ? (
        <div className="supportmessagedate" role="separator">
          {day(message.createdAt)}
        </div>
      ) : null}
      <article className="supportmessage" data-author={message.authorType}>
        <span className="supportmessageavatar">{message.authorType === 'agent' ? '翼' : '客'}</span>
        <div>
          <header>
            <strong>{authorLabel(message)}</strong>
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          </header>
          <p>{message.body}</p>
          {attachments.length ? (
            <ul className="supportmessageattachments">
              {attachments.map((item) => (
                <li key={item.id}>
                  {item.download ? (
                    <a href={item.download.url} rel="noreferrer">
                      {item.name}
                    </a>
                  ) : (
                    <span>{item.name}</span>
                  )}
                  <em>{item.state === 'clean' ? '已通过安全检查' : item.state === 'pending' ? '安全扫描中' : '已拒绝'}</em>
                </li>
              ))}
            </ul>
          ) : null}
          <small>已发送 · #{message.sequence}</small>
        </div>
      </article>
    </>
  );
}
function DraftBubble({ draft, state }: Readonly<{ draft: MessageDraft; state: 'sending' | 'failed' }>) {
  return (
    <article className="supportmessage" data-author="agent" data-delivery={state}>
      <span className="supportmessageavatar">翼</span>
      <div>
        <header>
          <strong>客服 · 当前账号</strong>
        </header>
        <p>{draft.message}</p>
        <small>{state === 'sending' ? '正在发送…' : '发送失败，可使用下方按钮原样重试'}</small>
      </div>
    </article>
  );
}
function day(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}
