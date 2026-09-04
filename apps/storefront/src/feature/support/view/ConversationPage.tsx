import { ArrowLeft, CircleAlert, LoaderCircle, Paperclip, RefreshCw } from 'lucide-react';
import { chineseReference } from '@shop/presentation';
import { useLayoutEffect, useRef } from 'react';
import type { SupportAttachment } from '../model/Attachment';
import type { MessageDraft, SupportMessage } from '../model/Message';
import type { useConversationViewModel } from '../viewmodel/ConversationViewModel';
import { SupportComposer } from './SupportComposer';
import './Support.css';

export function ConversationPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useConversationViewModel> }>) {
  const { caseId, ticket, connected, error, state, messages, attachments, hasEarlier, loadingEarlier, draft, failed, sending, sendingDraft, unavailable, newMessage, actions } = viewmodel;
  const viewport = useRef<HTMLDivElement>(null);
  const scroll = useRef({ caseId, first: 0, last: 0, height: 0, bottom: true });
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const first = messages[0]?.sequence ?? 0;
    const last = messages.at(-1)?.sequence ?? 0;
    const previous = scroll.current;
    if (previous.caseId !== caseId) {
      element.scrollTop = element.scrollHeight;
      actions.setNewMessage(false);
    } else if (previous.first && first < previous.first) element.scrollTop += element.scrollHeight - previous.height;
    else if (last > previous.last && previous.bottom) {
      element.scrollTop = element.scrollHeight;
      actions.setNewMessage(false);
    } else if (last > previous.last) actions.setNewMessage(true);
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
    scroll.current = { caseId, first, last, height: element.scrollHeight, bottom };
    if (bottom && last) actions.markRead(last);
  }, [actions, caseId, messages]);

  return (
    <div className="storesupportconversation">
      <header className="storesupportconversationheader">
        <button type="button" aria-label="返回客服中心" onClick={actions.back}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <p>智慧翼 · 客户服务</p>
          <h1>{ticket?.subject ?? '工单会话'}</h1>
          <span>
            {chineseReference('工单', caseId)} · {connected ? '实时连接正常' : '正在恢复实时连接'}
          </span>
        </div>
        <button type="button" aria-label="刷新会话" onClick={actions.refresh}>
          <RefreshCw size={17} />
        </button>
      </header>
      {error ? (
        <p className="storesupporterror" role="alert">
          <CircleAlert size={16} />
          {error}
        </p>
      ) : null}
      <section
        className="storesupportmessages"
        ref={viewport}
        aria-label="工单消息"
        onScroll={(event) => {
          const element = event.currentTarget;
          const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
          scroll.current = { ...scroll.current, height: element.scrollHeight, bottom };
          if (bottom) {
            actions.setNewMessage(false);
            actions.markRead(messages.at(-1)?.sequence ?? 0);
          }
        }}
      >
        {hasEarlier ? (
          <button className="storesupportearlier" type="button" disabled={loadingEarlier} onClick={actions.loadEarlier}>
            {loadingEarlier ? '加载中…' : '加载更早消息'}
          </button>
        ) : null}
        {state === 'loading' ? (
          <p className="storesupportloading" role="status">
            <LoaderCircle size={18} />
            正在读取会话…
          </p>
        ) : null}
        {messages.map((item, index) => (
          <MessageBubble key={item.id} message={item} attachments={attachments.filter((attachment) => attachment.messageId === item.id)} showDate={index === 0 || day(item.createdAt) !== day(messages[index - 1].createdAt)} />
        ))}
        {sending && sendingDraft ? <DraftBubble draft={sendingDraft} state="sending" /> : failed ? <DraftBubble draft={failed} state="failed" /> : null}
        {newMessage ? (
          <button
            className="storesupportnewmessage"
            type="button"
            onClick={() => {
              if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
              actions.setNewMessage(false);
            }}
          >
            有新消息
          </button>
        ) : null}
        {state === 'empty' ? <p className="storesupportempty">尚无消息，可以在下方开始咨询</p> : null}
      </section>
      <SupportComposer
        value={draft.message}
        unavailable={unavailable}
        sending={sending}
        failed={failed !== null}
        attachments={draft.attachments}
        onChange={actions.changeMessage}
        onSend={actions.send}
        onRetry={actions.retry}
        onFile={actions.upload}
      />
    </div>
  );
}

function MessageBubble({ message, attachments, showDate }: Readonly<{ message: SupportMessage; attachments: readonly SupportAttachment[]; showDate: boolean }>) {
  return (
    <>
      {showDate ? <div className="storesupportdate">{day(message.createdAt)}</div> : null}
      <article className="storesupportmessage" data-author={message.authorType}>
        <div>
          <strong>{message.authorType === 'member' ? '我' : '客服'}</strong>
          <time dateTime={message.createdAt}>{format(message.createdAt)}</time>
        </div>
        <p>{message.body}</p>
        {attachments.length ? (
          <ul>
            {attachments.map((item) => (
              <li key={item.id}>
                <Paperclip size={14} />
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
      </article>
    </>
  );
}
function DraftBubble({ draft, state }: Readonly<{ draft: MessageDraft; state: 'sending' | 'failed' }>) {
  return (
    <article className="storesupportmessage" data-author="member" data-delivery={state}>
      <div>
        <strong>我</strong>
      </div>
      <p>{draft.message}</p>
      <small>{state === 'sending' ? '正在发送…' : '发送失败，可原样重试'}</small>
    </article>
  );
}
function day(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(value));
}
function format(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
