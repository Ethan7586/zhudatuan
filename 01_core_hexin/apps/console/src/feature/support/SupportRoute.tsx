import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { normalizeConsoleCopy } from '../../entity/session/ScopePresentation';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { SupportCaseRail } from './SupportCaseRail';
import { canCreateSupportCase, canSendSupportMessage, createSupportCase, sendSupportMessage } from './SupportCommand';
import { SupportContextPanel } from './SupportContextPanel';
import { SupportConversation } from './SupportConversation';
import { readCases, readMessages, supportCaseKey, supportMessageKey } from './SupportQuery';
import { supportRoleLabel } from './SupportPresentation';
import { SUPPORT_PREFETCH_STALE_TIME_MS } from './SupportPrefetch';
import type { SupportCaseView, SupportMessage, SupportMessageVisibility } from './SupportSchema';
import './support-layout.css';
import './support-conversation.css';
import './support-context.css';
import './support-responsive.css';

export function Component() {
  const context = useConsoleContext();
  const navigate = useNavigate();
  const { caseId } = useParams();
  const [search, setSearch] = useSearchParams();
  const [creatingCase, setCreatingCase] = useState(false);
  const supportPath = scopePath(context.scope, 'support');
  const caseView = supportCaseView(search.get('view'));
  const caseCursor = search.get('cursor') ?? undefined;
  const queueSearch = search.toString();
  const supportQueuePath = queueSearch.length === 0 ? supportPath : `${supportPath}?${queueSearch}`;
  const casesQuery = useQuery({
    queryKey: supportCaseKey(context, caseView, caseCursor),
    queryFn: ({ signal }) => readCases(context, caseView, caseCursor, signal),
    staleTime: SUPPORT_PREFETCH_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
  const messagesQuery = useQuery({
    queryKey: supportMessageKey(context, caseId ?? 'not-selected'),
    queryFn: ({ signal }) => readMessages(context, caseId!, undefined, signal),
    enabled: caseId !== undefined,
    staleTime: SUPPORT_PREFETCH_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  });
  const [olderMessages, setOlderMessages] = useState<readonly SupportMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<string>();
  const [historyLoaded, setHistoryLoaded] = useState(false);
  useEffect(() => {
    setOlderMessages([]);
    setOlderCursor(undefined);
    setHistoryLoaded(false);
  }, [caseId]);

  const selectedCase = casesQuery.data?.items.find(({ id }) => id === caseId);
  const messages = useMemo(() => [...olderMessages, ...(messagesQuery.data?.items ?? [])], [messagesQuery.data?.items, olderMessages]);
  const casesError = safeQueryError(casesQuery.error);
  const messagesError = safeQueryError(messagesQuery.error);
  const casesCondition = queryCondition({ pending: casesQuery.isPending, fetching: casesQuery.isFetching,
    error: casesQuery.error, hasData: casesQuery.data !== undefined, empty: casesQuery.data?.items.length === 0, stale: false });
  const messagesCondition = caseId === undefined ? 'empty' : queryCondition({ pending: messagesQuery.isPending,
    fetching: messagesQuery.isFetching, error: messagesQuery.error, hasData: messagesQuery.data !== undefined,
    empty: messages.length === 0, stale: false });
  const sendAllowed = selectedCase !== undefined && canSendSupportMessage(context, selectedCase.state);
  const createAllowed = canCreateSupportCase(context);
  const createUnavailableReason = createAllowed ? '' : '当前身份没有新建工单权限';
  const sendUnavailableReason = selectedCase === undefined ? '工单详情尚未加载'
    : selectedCase.state.trim().toLowerCase() === 'closed' ? '已关闭工单不能发送回复'
      : !context.session.permissions.includes('support.message.send')
        || !context.session.capabilities.includes('support.messages.send') ? '当前身份无发送权限'
        : '当前工单不可发送回复';
  const send = useMutation({
    mutationFn: async ({ message, visibility }: Readonly<{ message: string; visibility: SupportMessageVisibility }>) => {
      if (selectedCase === undefined) throw new Error('SUPPORT_CASE_NOT_LOADED');
      return sendSupportMessage(context, { caseId: selectedCase.id, caseVersion: selectedCase.version,
        caseState: selectedCase.state, message, visibility });
    },
    onSuccess: async () => { await Promise.all([messagesQuery.refetch(), casesQuery.refetch()]); },
  });
  const create = useMutation({
    mutationFn: (draft: Readonly<{ subject: string; message: string }>) => createSupportCase(context, draft),
    onSuccess: async (created) => {
      await casesQuery.refetch();
      setCreatingCase(false);
      const selectedSearch = new URLSearchParams(search);
      selectedSearch.delete('cursor');
      navigate({ pathname: `${supportPath}/${encodeURIComponent(created.id)}`, search: selectedSearch.toString() });
    },
  });
  const createError = safeQueryError(create.error);
  const sendError = safeQueryError(send.error);
  const scopeName = context.scope.name?.trim();
  const brandName = scopeName === undefined || scopeName.length === 0 ? '当前商城' : normalizeConsoleCopy(scopeName);
  const roleLabel = supportRoleLabel(context.session.governance?.level);
  const nextMessageCursor = historyLoaded ? olderCursor : messagesQuery.data?.nextCursor;
  const selectCaseView = (view: SupportCaseView) => {
    const next = new URLSearchParams(search);
    if (view === 'handling') next.delete('view');
    else next.set('view', view);
    next.delete('cursor');
    setCreatingCase(false);
    navigate({ pathname: supportPath, search: next.toString() });
  };
  const loadOlder = async (cursor: string) => {
    if (caseId === undefined) return;
    const page = await readMessages(context, caseId, cursor, new AbortController().signal);
    setOlderMessages((current) => [...page.items, ...current]);
    setOlderCursor(page.nextCursor);
    setHistoryLoaded(true);
  };

  return (
    <section className="supportpage" aria-label="服务中心">
      <header className="supportworkspaceheader">
        <div><h1>服务中心</h1><p>消费者与管理员共用一个工作台</p></div>
        <div className="supportworkspacestatus" aria-label="当前受理状态">
          <div className="supportstatuschips">
            <span className="supportidentitylabel">当前身份 <strong>{roleLabel}</strong></span>
            <span className="supportonlinestatus"><i aria-hidden="true" />在线受理</span>
          </div>
          <button className="supportworkspacerefresh" type="button" disabled={casesQuery.isFetching}
            aria-label="刷新服务中心" onClick={() => { void casesQuery.refetch(); }}>
            <RefreshIcon /><span>{casesQuery.isFetching ? '刷新中' : '刷新工单'}</span>
          </button>
        </div>
      </header>
      <nav className="supporttasktabs" aria-label="工单任务入口">
        <button type="button" aria-current={caseView === 'handling' ? 'page' : undefined}
          onClick={() => selectCaseView('handling')}>待我处理 <strong>{casesQuery.data?.views.handling ?? 0}</strong></button>
        <button type="button" disabled title="下一批接入">待我审批 <strong>0</strong></button>
        <button type="button" aria-current={caseView === 'created' ? 'page' : undefined}
          onClick={() => selectCaseView('created')}>我发起的 <strong>{casesQuery.data?.views.created ?? 0}</strong></button>
        <button type="button" aria-current={caseView === 'all' ? 'page' : undefined}
          onClick={() => selectCaseView('all')}>全部工单 <strong>{casesQuery.data?.views.all ?? 0}</strong></button>
      </nav>
      <div className="supportworkspace" data-case-selected={caseId === undefined && !creatingCase ? 'false' : 'true'}>
        <SupportCaseRail canCreate={createAllowed} cases={casesQuery.data?.items ?? []} condition={casesCondition}
          count={casesQuery.data?.count ?? 0} {...(casesError === undefined ? {} : { error: casesError })}
          createUnavailableReason={createUnavailableReason} creating={creatingCase}
          {...(casesQuery.data?.nextCursor === undefined ? {} : { nextCursor: casesQuery.data.nextCursor })}
          {...(caseId === undefined ? {} : { selectedCaseId: caseId })} queueSearch={queueSearch} supportPath={supportPath}
          onCreate={() => setCreatingCase((current) => !current)} onRetry={() => { void casesQuery.refetch(); }}
          onNext={(cursor) => setSearch(pageCursor(search, cursor))} />
        <SupportConversation canSend={sendAllowed} backPath={supportQueuePath} {...(caseId === undefined ? {} : { caseId })}
          canCreateCase={createAllowed} condition={messagesCondition}
          {...(create.isError ? { createCaseError: `新建失败，请保留内容后重试。 ${createError ?? 'REQUEST_FAILED'}` } : {})}
          createUnavailableReason={createUnavailableReason} creatingCase={creatingCase} creatingCasePending={create.isPending} messages={messages}
          {...(nextMessageCursor === undefined ? {} : { nextCursor: nextMessageCursor })}
          {...(selectedCase === undefined ? {} : { selectedCase })}
          {...(messagesError === undefined ? {} : { error: messagesError })}
          {...(send.isError ? { sendError: `发送失败，请刷新工单后重试。 ${sendError ?? 'REQUEST_FAILED'}` } : {})}
          sending={send.isPending} sendUnavailableReason={sendUnavailableReason}
          onCancelCreate={() => setCreatingCase(false)} onCreateCase={(draft) => create.mutateAsync(draft).then(() => undefined)}
          onNext={(cursor) => { void loadOlder(cursor); }} onRetry={() => { void messagesQuery.refetch(); }}
          onSend={(message, visibility) => send.mutateAsync({ message, visibility }).then(() => undefined)} />
        <SupportContextPanel brandName={brandName} {...(selectedCase === undefined ? {} : { selectedCase })}
          {...(caseId === undefined ? {} : { caseId })} />
      </div>
    </section>
  );
}

function supportCaseView(raw: string | null): SupportCaseView {
  return raw === 'created' || raw === 'all' ? raw : 'handling';
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 7v5h-5" /><path d="M4 17v-5h5" />
    <path d="M6.1 8.2A7 7 0 0 1 18.8 7L20 9M4 15l1.2 2A7 7 0 0 0 17.9 15.8" />
  </svg>;
}
