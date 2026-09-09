import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { normalizeConsoleCopy } from '../../entity/session/ScopePresentation';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { SupportCaseRail } from './SupportCaseRail';
import { canSendSupportMessage, sendSupportMessage } from './SupportCommand';
import { SupportContextPanel } from './SupportContextPanel';
import { SupportConversation } from './SupportConversation';
import { readCases, readMessages, supportCaseKey, supportMessageKey } from './SupportQuery';
import { supportRoleLabel } from './SupportPresentation';
import type { SupportMessage } from './SupportSchema';
import './support-layout.css';
import './support-conversation.css';
import './support-context.css';
import './support-responsive.css';

export function Component() {
  const context = useConsoleContext();
  const { caseId } = useParams();
  const [search, setSearch] = useSearchParams();
  const caseCursor = search.get('cursor') ?? undefined;
  const casesQuery = useQuery({
    queryKey: supportCaseKey(context, caseCursor),
    queryFn: ({ signal }) => readCases(context, caseCursor, signal),
  });
  const messagesQuery = useQuery({
    queryKey: supportMessageKey(context, caseId ?? 'not-selected'),
    queryFn: ({ signal }) => readMessages(context, caseId!, undefined, signal),
    enabled: caseId !== undefined,
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
  const sendUnavailableReason = selectedCase === undefined ? '工单详情尚未加载'
    : selectedCase.state.trim().toLowerCase() === 'closed' ? '已关闭工单不能发送回复'
      : !context.session.permissions.includes('support.message.send')
        || !context.session.capabilities.includes('support.messages.send') ? '当前身份无发送权限'
        : '当前工单不可发送回复';
  const send = useMutation({
    mutationFn: async (message: string) => {
      if (selectedCase === undefined) throw new Error('SUPPORT_CASE_NOT_LOADED');
      return sendSupportMessage(context, { caseId: selectedCase.id, caseVersion: selectedCase.version,
        caseState: selectedCase.state, message });
    },
    onSuccess: async () => { await messagesQuery.refetch(); },
  });
  const supportPath = scopePath(context.scope, 'support');
  const scopeName = context.scope.name?.trim();
  const brandName = scopeName === undefined || scopeName.length === 0 ? '当前商城' : normalizeConsoleCopy(scopeName);
  const roleLabel = supportRoleLabel(context.session.governance?.level);
  const nextMessageCursor = historyLoaded ? olderCursor : messagesQuery.data?.nextCursor;
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
          <span className="supportidentitylabel">当前身份 <strong>{roleLabel}</strong></span>
          <span className="supportonlinestatus"><i aria-hidden="true" />在线受理</span>
        </div>
      </header>
      <nav className="supporttasktabs" aria-label="工单任务入口">
        <button type="button" aria-current="page">待我处理 <strong>{casesQuery.data?.count ?? 0}</strong></button>
        <button type="button" disabled title="下一批接入">待我审批 <strong>0</strong></button>
        <button type="button" disabled title="下一批接入">我发起的 <strong>0</strong></button>
        <button type="button" disabled title="下一批接入">全部工单 <strong>0</strong></button>
      </nav>
      <div className="supportworkspace" data-case-selected={caseId === undefined ? 'false' : 'true'}>
        <SupportCaseRail cases={casesQuery.data?.items ?? []} condition={casesCondition}
          count={casesQuery.data?.count ?? 0} {...(casesError === undefined ? {} : { error: casesError })}
          {...(casesQuery.data?.nextCursor === undefined ? {} : { nextCursor: casesQuery.data.nextCursor })}
          {...(caseId === undefined ? {} : { selectedCaseId: caseId })} supportPath={supportPath}
          onRetry={() => { void casesQuery.refetch(); }} onNext={(cursor) => setSearch(pageCursor(search, cursor))} />
        <SupportConversation canSend={sendAllowed} backPath={supportPath} {...(caseId === undefined ? {} : { caseId })}
          condition={messagesCondition} messages={messages}
          {...(nextMessageCursor === undefined ? {} : { nextCursor: nextMessageCursor })}
          {...(selectedCase === undefined ? {} : { selectedCase })}
          {...(messagesError === undefined ? {} : { error: messagesError })}
          {...(send.isError ? { sendError: '发送失败，请刷新工单后重试。' } : {})}
          sending={send.isPending} sendUnavailableReason={sendUnavailableReason}
          onNext={(cursor) => { void loadOlder(cursor); }} onRetry={() => { void messagesQuery.refetch(); }}
          onSend={(message) => send.mutateAsync(message).then(() => undefined)} />
        <SupportContextPanel brandName={brandName} {...(selectedCase === undefined ? {} : { selectedCase })}
          {...(caseId === undefined ? {} : { caseId })} />
      </div>
    </section>
  );
}
