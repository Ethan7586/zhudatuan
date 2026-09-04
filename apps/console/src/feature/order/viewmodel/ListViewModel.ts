import { OP_ORDER_IMPORTS_CREATE, OP_ORDER_ORDERS_EXPORT, OP_PAYMENT_RECOVERIES_READ } from '@shop/contract/ids';
import { chineseReference, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import type { OrderDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { ORDER_COLUMN_PREFERENCE, type OrderColumnKey } from '../model/OrderColumn';
import type { OrderListFilter, OrderView } from '../model/OrderFilter';
import type { OrderDetailTab } from '../model/Order';
import type { OrderQuery } from '../model/OrderQuery';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { scopeRoutePath } from '../../../shared/url/ScopePath';
import { useAfterSaleViewModel } from './AfterSaleViewModel';
import { useOrderDetailViewModel } from './DetailViewModel';
import { orderKey, orderRecoveryKey } from './OrderQueryKey';
import { readCursor, readDetailTab, readFilter, readPage, readSelected, readView, writeOrderCursor, writeOrderFilter, writeOrderSelection, writeOrderTab, writeOrderView } from './OrderSearch';
import { orderRecoveryState } from './RecoveryViewModel';
import { usePreference } from '../../../shared/preference/PreferenceState';
import { validateImportFile } from '../../../shared/import/ImportUploadGateway';
import { downloadImportTemplate } from '../../../shared/import/ImportTemplate';

export interface OrderImportEditor {
  readonly step: 1 | 2 | 3;
  readonly file: File | null;
  readonly confirmed: boolean;
}

export function useOrderListViewModel(context: ConsoleContext, dependencies: OrderDependencies, requestStepup: () => void) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const filter = readFilter(search);
  const view = readView(search);
  const selected = readSelected(search);
  const tab = readDetailTab(search);
  const cursor = readCursor(search);
  const pageindex = readPage(search);
  const cursors = useRef(new Map<number, string | undefined>([[1, undefined]]));
  if (cursor !== undefined && !cursors.current.has(pageindex)) cursors.current.set(pageindex, cursor);
  const listFilter: OrderQuery = { ...filter, view: view === 'aftersale' ? 'all' : view, ...(cursor === undefined ? {} : { cursor }) };
  const aftersaleFilter = { ...filter, ...(cursor === undefined ? {} : { cursor }) };
  const query = useQuery({
    queryKey: orderKey(context, listFilter),
    queryFn: ({ signal }) => dependencies.readList.execute(context, listFilter, signal),
    enabled: view !== 'aftersale',
    placeholderData: (previous) => previous,
  });
  const canReadRecoveries = canUseOperation(context, OP_PAYMENT_RECOVERIES_READ);
  const recoveryQuery = useQuery({
    queryKey: orderRecoveryKey(context, 'scope'),
    queryFn: ({ signal }) => dependencies.readRecoveries.execute(context, undefined, signal),
    enabled: view === 'exception' && canReadRecoveries,
  });
  const aftersale = useAfterSaleViewModel(context, dependencies, aftersaleFilter, view === 'aftersale', requestStepup, () => void query.refetch());
  const detail = useOrderDetailViewModel(context, dependencies, selected, requestStepup, () => void query.refetch());
  const [columnsopen, setColumnsOpen] = useState(false);
  const preference = useMemo(
    () =>
      Object.freeze({
        actor: context.session.actor,
        membership: context.session.membership,
        scope: Object.freeze({ kind: context.scope.kind, id: context.scope.id }),
        view: 'orders',
        name: 'columns',
      }),
    [context.scope.id, context.scope.kind, context.session.actor, context.session.membership]
  );
  const [columnpreference, setColumnPreference] = usePreference(dependencies.preferences, preference, ORDER_COLUMN_PREFERENCE);
  const columns = useMemo<ReadonlySet<OrderColumnKey>>(() => new Set(columnpreference), [columnpreference]);
  const [importEditor, setImportEditor] = useState<OrderImportEditor>();
  const [exportOpen, setExportOpen] = useState(false);
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [importIdentity, setImportIdentity] = useState(dependencies.createIdentity);
  const [exportIdentity, setExportIdentity] = useState(dependencies.createIdentity);
  const createImport = useMutation({ mutationFn: () => dependencies.createImport.execute(context, { file: importEditor!.file! }, importIdentity) });
  const createExport = useMutation({ mutationFn: () => dependencies.createExport.execute(context, filter, exportIdentity) });
  const resetPaging = () => {
    cursors.current = new Map([[1, undefined]]);
  };
  const applyFilter = (value: OrderListFilter) => {
    resetPaging();
    setSearch(writeOrderFilter(search, value));
  };
  const selectView = (nextView: OrderView) => {
    resetPaging();
    setSearch(writeOrderView(search, nextView));
  };
  const open = (id: string, nextTab: OrderDetailTab = 'overview') => setSearch(writeOrderSelection(search, id, nextTab));
  const close = () => setSearch(writeOrderSelection(search));
  const selectTab = (nextTab: OrderDetailTab) => setSearch(writeOrderTab(search, nextTab));
  const refresh = () => {
    if (view === 'aftersale') aftersale.retry();
    else void query.refetch();
    if (selected !== undefined) detail.refresh();
    if (view === 'exception' && canReadRecoveries) void recoveryQuery.refetch();
  };
  const toggleColumn = (key: OrderColumnKey) => {
    const next = new Set(columns);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setColumnPreference([...next]);
  };
  const malls = context.scopes.filter((scope) => scope.kind === 'mall').map((scope) => Object.freeze({ id: scope.id, label: scope.name ?? chineseReference('商城', scope.id) }));
  const nextCursor = view === 'aftersale' ? aftersale.data?.nextCursor : query.data?.nextCursor;
  const previousCursor = pageindex <= 2 ? undefined : cursors.current.get(pageindex - 1);
  const canPrevious = pageindex === 2 || previousCursor !== undefined;
  const next = () => {
    if (nextCursor === undefined) return;
    const target = pageindex + 1;
    cursors.current.set(target, nextCursor);
    setSearch(writeOrderCursor(search, nextCursor, target));
  };
  const previous = () => {
    if (!canPrevious) return;
    const target = pageindex - 1;
    setSearch(writeOrderCursor(search, target === 1 ? undefined : previousCursor, target));
  };
  const first = () => setSearch(writeOrderCursor(search, undefined, 1));
  return Object.freeze({
    view,
    filter,
    selected,
    tab,
    cursor,
    pageindex,
    columns,
    columnsopen,
    malls,
    detail,
    aftersale,
    recoveries: orderRecoveryState(canReadRecoveries, recoveryQuery),
    assurance: context.session.assurance.level,
    canImport: canUseOperation(context, OP_ORDER_IMPORTS_CREATE),
    canExport: canUseOperation(context, OP_ORDER_ORDERS_EXPORT),
    importing: Object.freeze({ editor: importEditor, template: dependencies.importTemplate, busy: createImport.isPending, result: createImport.data, error: safeQueryError(createImport.error), validation: importValidation(importEditor, context.session.assurance.level) }),
    exporting: Object.freeze({ open: exportOpen, confirmed: exportConfirmed, busy: createExport.isPending, result: createExport.data, error: safeQueryError(createExport.error), filter }),
    page: query.data,
    pending: query.isPending,
    fetching: view === 'aftersale' ? aftersale.fetching : query.isFetching,
    failed: query.isError,
    error: safeQueryError(query.error),
    actions: Object.freeze({
      applyFilter,
      selectView,
      open,
      openDetail: (id: string) => void navigate(scopeRoutePath(context.scope, 'consoleorderdetail', { orderId: id }), { state: { orderReturnTo: `${location.pathname}${location.search}` } }),
      openAftersale: (id: string) => open(id, 'aftersale'),
      close,
      selectTab,
      first,
      previous,
      next,
      refresh,
      toggleColumn,
      toggleColumns: () => setColumnsOpen((current) => !current),
      closeColumns: () => setColumnsOpen(false),
      openImport: () => {
        setImportEditor({ step: 1, file: null, confirmed: false });
        setImportIdentity(dependencies.createIdentity());
        createImport.reset();
      },
      closeImport: () => {
        if (!createImport.isPending) setImportEditor(undefined);
      },
      importStep: (step: 1 | 2 | 3) => setImportEditor((current) => (current ? { ...current, step } : current)),
      importFile: (file: File | null) => {
        setImportIdentity(dependencies.createIdentity());
        createImport.reset();
        setImportEditor((current) => (current ? { ...current, file, confirmed: false } : current));
      },
      importConfirmed: (confirmed: boolean) => setImportEditor((current) => (current ? { ...current, confirmed } : current)),
      downloadImportTemplate: () => downloadImportTemplate(dependencies.importTemplate.kind, dependencies.importTemplate.columns),
      submitImport: () => {
        if (importValidation(importEditor, context.session.assurance.level) === undefined && !createImport.isPending) createImport.mutate();
      },
      openImportTask: () => {
        if (createImport.data) void navigate(scopeRoutePath(context.scope, 'consoleimporttask', { kind: 'order', jobId: createImport.data.id }));
      },
      openExport: () => {
        if (context.session.assurance.level < 3) requestStepup();
        else {
          setExportOpen(true);
          setExportConfirmed(false);
          setExportIdentity(dependencies.createIdentity());
          createExport.reset();
        }
      },
      closeExport: () => {
        if (!createExport.isPending) {
          setExportOpen(false);
          setExportConfirmed(false);
        }
      },
      exportConfirmed: setExportConfirmed,
      submitExport: () => {
        if (exportConfirmed && !createExport.isPending) createExport.mutate();
      },
      stepup: requestStepup,
    }),
    pagination: Object.freeze({ canFirst: pageindex > 1, canPrevious, canNext: nextCursor !== undefined }),
  });
}

function importValidation(editor: OrderImportEditor | undefined, assurance: number): string | undefined {
  if (!editor) return undefined;
  if (editor.step === 1) return undefined;
  if (!editor.file) return '请选择 CSV 或 XLSX 文件。';
  const fileError = validateImportFile(editor.file);
  if (fileError) return fileError;
  if (editor.step === 2) return undefined;
  if (!editor.confirmed) return '请确认服务端将校验来源证明、映射、金额分解和重复订单。';
  return assurance < 3 ? '提交外部订单前请完成高强度二次验证。' : undefined;
}

export type ListViewModel = ReturnType<typeof useOrderListViewModel>;
