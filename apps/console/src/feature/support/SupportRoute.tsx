import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { scopePath } from '../../shared/url/ScopePath';
import { SupportCaseRail } from './SupportCaseRail';
import { canSendSupportMessage, sendSupportMessage } from './SupportCommand';
import { SupportContextPanel } from './SupportContextPanel';
import { SupportConversation } from './SupportConversation';
import { readCases, readMessages, supportCaseKey, supportMessageKey } from './SupportQuery';
import './support-layout.css';
import './support-conversation.css';
import './support-context.css';
import './support-responsive.css';

export function Component() {
  const context = useConsoleContext();
  const queryClient = useQueryClient();
  const { caseId } = useParams();
  const [search, setSearch] = useSearchParams();
  const caseCursor = search.get('caseCursor') ?? undefined;
  const casesQuery = useQuery({
    queryKey: supportCaseKey(context, caseCursor),
    queryFn: ({ signal }) => readCases(context, caseCursor, signal),
    staleTime: 30_000,
  });
  const messagesQuery = useInfiniteQuery({
    queryKey: supportMessageKey(context, caseId ?? 'unselected'),
    queryFn: ({ signal, pageParam }) => readMessages(context, caseId ?? '', pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    enabled: caseId !== undefined,
    staleTime: 15_000,
  });
  const messagePages = messagesQuery.data?.pages;
  const messages = useMemo(() => [...(messagePages ?? [])].reverse().flatMap((page) => page.items), [messagePages]);
  const nextMessageCursor = messagesQuery.hasNextPage ? messagesQuery.data?.pages.at(-1)?.nextCursor : undefined;
  const selectedCase = useMemo(() => casesQuery.data?.items.find((item) => item.id === caseId), [caseId, casesQuery.data]);
  const mutation = useMutation({
    mutationFn: (message: string) => {
      if (caseId === undefined || selectedCase === undefined) throw new Error('SUPPORT_CASE_CONTEXT_MISSING');
      return sendSupportMessage(context, {
        caseId,
        caseVersion: selectedCase.version,
        caseState: selectedCase.state,
        message,
      });
    },
    onSuccess: async () => {
      if (caseId === undefined) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: supportCaseKey(context, caseCursor), exact: true }),
        queryClient.invalidateQueries({ queryKey: supportMessageKey(context, caseId), exact: true }),
      ]);
    },
  });
  const caseCondition = queryCondition({
    pending: casesQuery.isPending,
    fetching: casesQuery.isFetching,
    error: casesQuery.error,
    hasData: casesQuery.data !== undefined,
    empty: casesQuery.data?.items.length === 0,
    stale: casesQuery.isStale,
  });
  const messageCondition = queryCondition({
    pending: messagesQuery.isPending,
    fetching: messagesQuery.isFetching,
    error: messagesQuery.error,
    hasData: messagesQuery.data !== undefined,
    empty: messages.length === 0,
    stale: messagesQuery.isStale,
  });
  const caseError = safeQueryError(casesQuery.error);
  const messageError = safeQueryError(messagesQuery.error);
  const canSend = selectedCase !== undefined && canSendSupportMessage(context, selectedCase.state);
  const updateCaseCursor = (value: string) => {
    const next = new URLSearchParams(search);
    next.set('caseCursor', value);
    setSearch(next);
  };
  const refresh = () => {
    void casesQuery.refetch();
    if (caseId !== undefined) void messagesQuery.refetch();
  };

  return (
    <section className="supportworkspace">
      <header className="supportworkspaceheader">
        <div>
          <p>ZHUDATUAN · CUSTOMER CARE</p>
          <h1 tabIndex={-1}>客服系统</h1>
          <span>统一处理福利平台咨询与售后工单，消息读取、发送和权限均走正式客服服务。</span>
        </div>
        <div className="supportworkspacestatus">
          <span><i aria-hidden="true" />服务端安全会话</span>
          <button type="button" onClick={refresh}>刷新工作区</button>
        </div>
      </header>
      <div className="supportdesk" data-case-selected={caseId === undefined ? 'false' : 'true'}>
        <SupportCaseRail cases={casesQuery.data?.items ?? []} count={casesQuery.data?.count ?? 0}
          condition={caseCondition} supportPath={scopePath(context.scope, 'support')}
          {...(caseId === undefined ? {} : { selectedCaseId: caseId })}
          {...(caseError === undefined ? {} : { error: caseError })}
          {...(casesQuery.data?.nextCursor === undefined ? {} : { nextCursor: casesQuery.data.nextCursor })}
          onRetry={() => { void casesQuery.refetch(); }} onNext={updateCaseCursor} />
        <SupportConversation {...(caseId === undefined ? {} : { caseId })}
          {...(selectedCase === undefined ? {} : { selectedCase })}
          messages={messages} condition={caseId === undefined ? 'empty' : messageCondition}
          {...(messageError === undefined ? {} : { error: messageError })}
          {...(nextMessageCursor === undefined ? {} : { nextCursor: nextMessageCursor })}
          backPath={scopePath(context.scope, 'support')}
          canSend={canSend} sending={mutation.isPending}
          {...(mutation.error === null ? {} : { sendError: '发送失败，请刷新工单后重试。' })}
          sendUnavailableReason={sendUnavailableReason(context, caseId, selectedCase?.state)}
          onRetry={() => { void messagesQuery.refetch(); }} onNext={() => { void messagesQuery.fetchNextPage(); }}
          onSend={async (message) => { await mutation.mutateAsync(message); }} />
        <SupportContextPanel {...(caseId === undefined ? {} : { caseId })}
          {...(selectedCase === undefined ? {} : { selectedCase })} />
      </div>
    </section>
  );
}

function sendUnavailableReason(context: ReturnType<typeof useConsoleContext>, caseId?: string, state?: string): string {
  if (caseId === undefined) return '请先选择一条工单';
  if (state === undefined) return '当前页没有此工单详情，暂不能回复';
  if (state.toLowerCase() === 'closed') return '工单已关闭，不能继续回复';
  if (context.session.csrf === undefined) return '安全会话尚未就绪，暂不能发送';
  if (!context.session.permissions.includes('support.message.send') || !context.session.capabilities.includes('support.messages.send')) {
    return '当前账号没有客服消息发送权限';
  }
  return '';
}
