import { type Receipt, queryCondition, safeQueryError } from '@shop/presentation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { ChannelDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { pageCursor } from '../../../shared/url/PageCursor';
import { channelOperations, channelViews, type ChannelConnection, type ChannelOperation, type ChannelSync, type ChannelView } from '../model/Channel';
import type { ChannelAction } from '../model/ChannelAction';
import type { ChannelCommand } from '../model/ChannelCommand';
import { useChannelActionViewModel } from './ChannelActionViewModel';
import { channelKey, channelPrefix } from './ChannelQueryKey';

export function useChannelViewModel(context: ConsoleContext, dependencies: ChannelDependencies, requestStepup: () => void) {
  const cache = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const [action, setAction] = useState<ChannelAction | null>(null);
  const [receipt, setReceipt] = useState<Receipt>();
  const availableViews = useMemo(() => channelViews.filter((view) => canUseOperation(context, readOperation(view))), [context]);
  const view = readView(search.get('view'), availableViews);
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery({ queryKey: channelKey(context, view, cursor), queryFn: ({ signal }) => dependencies.read.execute(context, view, cursor, signal), staleTime: 30_000 });
  const searchValue = search.toString();
  const update = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchValue);
      mutate(next);
      setSearch(next);
    },
    [searchValue, setSearch]
  );
  const done = useCallback(
    (command: ChannelCommand) => {
      setAction(null);
      setReceipt(Object.freeze({ requestId: command.identity, reference: reference(command), occurredAt: new Date().toISOString(), message: receiptMessage(command) }));
      const nextView = targetView(command);
      const next = new URLSearchParams();
      next.set('view', nextView);
      setSearch(next);
      void cache.invalidateQueries({ queryKey: channelPrefix(context) });
    },
    [cache, context, setSearch]
  );
  const actionModel = useChannelActionViewModel(action, context, dependencies, requestStepup, done);
  const rows = query.data?.items ?? [];
  const permissions = useMemo(
    () =>
      Object.freeze({
        create: canUseOperation(context, channelOperations.create),
        update: canUseOperation(context, channelOperations.update),
        test: canUseOperation(context, channelOperations.test),
        enable: canUseOperation(context, channelOperations.enable),
        disable: canUseOperation(context, channelOperations.disable),
        startSync: canUseOperation(context, channelOperations.startSync),
        cancelSync: canUseOperation(context, channelOperations.cancelSync),
        replay: canUseOperation(context, channelOperations.replay),
      }),
    [context]
  );
  const refresh = query.refetch;
  const actions = useMemo(
    () =>
      Object.freeze({
        refresh: () => void refresh(),
        selectView: (next: ChannelView) =>
          update((params) => {
            params.set('view', next);
            params.delete('cursor');
          }),
        next: () => {
          if (query.data?.nextCursor) setSearch(pageCursor(new URLSearchParams(searchValue), query.data.nextCursor));
        },
        create: () => setAction({ kind: 'create' }),
        update: (connection: ChannelConnection) => setAction({ kind: 'update', connection }),
        test: (connection: ChannelConnection) => setAction({ kind: 'test', connection }),
        enable: (connection: ChannelConnection) => setAction({ kind: 'enable', connection }),
        disable: (connection: ChannelConnection) => setAction({ kind: 'disable', connection }),
        startSync: (connection?: ChannelConnection) => setAction({ kind: 'startsync', ...(connection ? { connection } : {}) }),
        cancelSync: (sync: ChannelSync) => setAction({ kind: 'cancelsync', sync }),
        replay: (operation: ChannelOperation) => setAction({ kind: 'replay', operation }),
        closeAction: () => setAction(null),
        dismissReceipt: () => setReceipt(undefined),
      }),
    [query.data?.nextCursor, refresh, searchValue, setSearch, update]
  );
  return Object.freeze({
    scope: context.scope.name ?? context.scope.id,
    view,
    availableViews,
    rows,
    count: query.data?.count ?? 0,
    nextCursor: query.data?.nextCursor,
    permissions,
    action: actionModel,
    receipt,
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: query.data !== undefined, empty: rows.length === 0 }),
    error: safeQueryError(query.error),
    actions,
  });
}

export type ChannelViewModel = ReturnType<typeof useChannelViewModel>;

function readOperation(view: ChannelView) {
  return view === 'connections' ? channelOperations.readConnections : view === 'syncs' ? channelOperations.readSyncs : channelOperations.readOperations;
}
function readView(value: string | null, available: readonly ChannelView[]): ChannelView {
  return available.includes(value as ChannelView) ? (value as ChannelView) : (available[0] ?? 'connections');
}
function targetView(command: ChannelCommand): ChannelView {
  return command.kind === 'startsync' || command.kind === 'cancelsync' ? 'syncs' : command.kind === 'replay' ? 'operations' : 'connections';
}
function reference(command: ChannelCommand): string {
  return command.kind === 'create' ? command.draft.provider : command.kind === 'startsync' ? command.draft.connection : command.kind === 'cancelsync' ? command.sync : command.kind === 'replay' ? command.operation : command.connection;
}
function receiptMessage(command: ChannelCommand): string {
  return command.kind === 'test'
    ? '真实沙箱连通性测试已提交，请在连接健康状态中查看结果。'
    : command.kind === 'startsync'
      ? '同步任务已进入可恢复任务队列，可在同步批次中查看水位与进度。'
      : command.kind === 'replay'
        ? '外部操作已按原内部引用重新入队。'
        : '渠道操作已提交，列表正在进行权威重读。';
}
