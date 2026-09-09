import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { pageCursor } from '../../shared/url/PageCursor';
import { scopePath } from '../../shared/url/ScopePath';
import { SupportCaseRail } from './SupportCaseRail';
import { canSendSupportMessage, sendSupportMessage } from './SupportCommand';
import { SupportContextPanel } from './SupportContextPanel';
import { SupportConversation } from './SupportConversation';
import { readCases, readMessages, supportCaseKey, supportMessageKey } from './SupportQuery';
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
    error: casesQuery.error, hasData: casesQuery.data !== undefined, empty: casesQuery.data?.items.length === 0, stale: casesQuery.isStale });
  const messagesCondition = caseId === undefined ? 'empty' : queryCondition({ pending: messagesQuery.isPending,
    fetching: messagesQuery.isFetching, error: messagesQuery.error, hasData: messagesQuery.data !== undefined,
    empty: messages.length === 0, stale: messagesQuery.isStale });
  const sendAllowed = selectedCase !== undefined && canSendSupportMessage(context, selectedCase.state);
  const send = useMutation({
    mutationFn: async (message: string) => {
      if (selectedCase === undefined) throw new Error('SUPPORT_CASE_NOT_LOADED');
      return sendSupportMessage(context, { caseId: selectedCase.id, caseVersion: selectedCase.version,
        caseState: selectedCase.state, message });
    },
    onSuccess: async () => { await messagesQuery.refetch(); },
  });
  const supportPath = scopePath(context.scope, 'support');
  const nextMessageCursor = historyLoaded ? olderCursor : messagesQuery.data?.nextCursor;
  const loadOlder = async (cursor: string) => {
    if (caseId === undefined) return;
    const page = await readMessages(context, caseId, cursor, new AbortController().signal);
    setOlderMessages((current) => [...page.items, ...current]);
    setOlderCursor(page.nextCursor);
    setHistoryLoaded(true);
  };

  return (
    <section className="supportpage" aria-label="客服系统">
      <header className="supportpageheader"><div><p>SMART WING SUPPORT</p><h1>客服系统</h1></div></header>
      <div className="supportworkspace">
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
          sending={send.isPending} sendUnavailableReason="当前工单不可发送回复"
          onNext={(cursor) => { void loadOlder(cursor); }} onRetry={() => { void messagesQuery.refetch(); }}
          onSend={(message) => send.mutateAsync(message).then(() => undefined)} />
        <SupportContextPanel {...(selectedCase === undefined ? {} : { selectedCase })}
          {...(caseId === undefined ? {} : { caseId })} />
      </div>
    </section>
  );
}
