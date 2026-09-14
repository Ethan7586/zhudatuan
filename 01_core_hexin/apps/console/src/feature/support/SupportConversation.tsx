import { ResourceState, type ResourceCondition } from '@shop/design';
import { type FormEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { SupportCase, SupportMessage, SupportMessageVisibility } from './SupportSchema';
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
  readonly canCreateCase: boolean;
  readonly caseId?: string;
  readonly condition: ResourceCondition;
  readonly createCaseError?: string;
  readonly createUnavailableReason: string;
  readonly creatingCase: boolean;
  readonly creatingCasePending: boolean;
  readonly error?: string;
  readonly messages: readonly SupportMessage[];
  readonly onCancelCreate: () => void;
  readonly onCreateCase: (draft: Readonly<{ subject: string; message: string }>) => Promise<void>;
  readonly nextCursor?: string;
  readonly onNext: (cursor: string) => void;
  readonly onRetry: () => void;
  readonly onSend: (message: string, visibility: SupportMessageVisibility) => Promise<void>;
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

  if (props.creatingCase) return <SupportCaseComposer canCreate={props.canCreateCase} creating={props.creatingCasePending}
    unavailableReason={props.createUnavailableReason} onCancel={props.onCancelCreate} onCreate={props.onCreateCase}
    {...(props.createCaseError === undefined ? {} : { error: props.createCaseError })} />;
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

function SupportCaseComposer({ canCreate, creating, error, unavailableReason, onCancel, onCreate }: Readonly<{
  canCreate: boolean;
  creating: boolean;
  error?: string;
  unavailableReason: string;
  onCancel: () => void;
  onCreate: (draft: Readonly<{ subject: string; message: string }>) => Promise<void>;
}>) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const ready = canCreate && !creating && subject.trim().length > 0 && message.trim().length > 0;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    try {
      await onCreate({ subject, message });
    } catch {
      // The mutation keeps this local draft intact and renders the error below.
    }
  };
  return (
    <section className="supportconversation supportnewcase" aria-labelledby="supportnewcasetitle">
      <header className="supportconversationheader supportnewcaseheader">
        <div><span className="supportnewcaseicon" aria-hidden="true"><NewConversationMark /></span>
          <div><h2 id="supportnewcasetitle">新建工单</h2><p>直接在工作台里开始一段新的服务对话</p></div>
        </div>
        <button type="button" onClick={onCancel} aria-label="关闭新建工单">×</button>
      </header>
      <form className="supportnewcaseform" onSubmit={(event) => { void submit(event); }}>
        <div className="supportnewcaseintro"><span>新对话</span><strong>需要处理什么问题？</strong>
          <p>写下简洁标题和第一条留言，创建后会直接进入会话。</p></div>
        <label><span>工单标题</span><input autoFocus value={subject} maxLength={120} disabled={!canCreate || creating}
          onChange={(event) => setSubject(event.target.value)} placeholder="例如：退款进度需要核实" /></label>
        <label><span>第一条留言</span><textarea value={message} maxLength={4000} rows={7} disabled={!canCreate || creating}
          onChange={(event) => setMessage(event.target.value)} placeholder="补充问题经过、关联信息和期望处理结果…" /></label>
        <div className="supportnewcasemeta"><span>应用内</span><span>普通优先级</span><em>{message.length}/4000</em></div>
        <div className="supportnewcaseactions">
          <span role="status" aria-live="polite" data-tone={error === undefined ? 'quiet' : 'attention'}>
            {creating ? '正在创建…' : error ?? (!canCreate ? unavailableReason : '')}
          </span>
          <button type="button" onClick={onCancel} disabled={creating}>取消</button>
          <button type="submit" disabled={!ready}>{creating ? '创建中' : '创建并进入会话'}</button>
        </div>
      </form>
    </section>
  );
}

function NewConversationMark() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5.25 5.75h13.5a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H10l-4.75 2.5v-2.5a2 2 0 0 1-2-2v-8.5a2 2 0 0 1 2-2Z" />
    <path d="M12 9v6M9 12h6" />
  </svg>;
}

function MessageBubble({ message, showDate }: Readonly<{ message: SupportMessage; showDate: boolean }>) {
  const agent = message.authorType.toLowerCase() === 'agent';
  const internal = message.visibility === 'internal';
  return (
    <>{showDate ? <div className="supportmessagedate" role="separator">{day(message.createdAt)}</div> : null}
      <article className="supportmessage" data-author={agent ? 'agent' : 'customer'} data-visibility={message.visibility}>
        <span className="supportmessageavatar" aria-hidden="true">{internal ? '内' : supportAuthorInitial(message.authorType)}</span>
        <div>
          <header><strong>{internal ? `内部备注 · ${supportAuthorLabel(message.authorType)}` : supportAuthorLabel(message.authorType)}</strong>
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
  onSend: (message: string, visibility: SupportMessageVisibility) => Promise<void>;
}>) {
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<SupportMessageVisibility>('public');
  const publicMode = useRef<HTMLButtonElement>(null);
  const internalMode = useRef<HTMLButtonElement>(null);
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSend || sending || draft.trim().length === 0) return;
    try {
      await onSend(draft, visibility);
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
  const modeKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'End' ? 'internal'
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'Home' ? 'public' : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setVisibility(next);
    (next === 'internal' ? internalMode : publicMode).current?.focus();
  };
  const internal = visibility === 'internal';
  return (
    <form className="supportcomposer" data-visibility={visibility} onSubmit={(event) => { void submit(event); }}>
      <div className="supportcomposermodes" role="tablist" aria-label="消息类型">
        <button ref={publicMode} id="support-message-mode-public" type="button" role="tab" aria-selected={!internal}
          aria-controls="support-message-editor" tabIndex={internal ? -1 : 0} onKeyDown={modeKeyDown}
          onClick={() => setVisibility('public')}>回复发起人</button>
        <button ref={internalMode} id="support-message-mode-internal" type="button" role="tab" aria-selected={internal}
          aria-controls="support-message-editor" tabIndex={internal ? 0 : -1} onKeyDown={modeKeyDown}
          onClick={() => setVisibility('internal')}>内部备注</button>
        <button type="button" role="tab" aria-selected="false" disabled title="下一批接入">协同供应商</button>
      </div>
      <div className="supportcomposerbox" id="support-message-editor" role="tabpanel"
        aria-labelledby={internal ? 'support-message-mode-internal' : 'support-message-mode-public'}>
        <textarea value={draft} maxLength={4000} rows={4} disabled={!canSend || sending}
          onChange={(event) => setDraft(event.target.value)} onKeyDown={keyDown}
          placeholder={canSend ? internal ? '输入仅工作人员可见的内部备注…' : '请输入回复内容…' : unavailableReason}
          aria-label={internal ? '内部备注内容' : '回复内容'} />
        <div className="supportcomposeractions">
          <div className="supportcomposerattachments" aria-label="尚未接入的消息附件">
            <button type="button" disabled title="下一批接入" aria-label="添加附件（下一批接入）">⌕</button>
            <button type="button" disabled title="下一批接入" aria-label="添加图片（下一批接入）">▧</button>
            <button type="button" disabled title="下一批接入" aria-label="添加文件（下一批接入）">▤</button>
          </div>
          <span role="status" aria-live="polite">{sending ? internal ? '添加中…' : '发送中…' : sendError ?? (!canSend ? unavailableReason : `${draft.length}/4000`)}</span>
          <button type="submit" disabled={!canSend || sending || draft.trim().length === 0}>
            {sending ? internal ? '添加中' : '发送中' : internal ? '添加备注' : '发送回复'}
          </button>
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
