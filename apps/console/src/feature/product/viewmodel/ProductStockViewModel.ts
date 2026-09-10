import { OP_INVENTORY_AVAILABILITY_READ, OP_INVENTORY_IMPORTS_CREATE, OP_RUNTIME_IMPORTS_CONFIRM, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import type { ProductDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../shared/security/OperationAccess';
import { taskImportPath } from '../../../shared/task/TaskLaunch';
import type { Listing } from '../model/Product';
import type { ProductRestockStage } from '../application/RestockProduct';
import { isManagedListing } from '../model/ProductAction';

const STOCK_OPERATIONS = Object.freeze([OP_INVENTORY_AVAILABILITY_READ, OP_INVENTORY_IMPORTS_CREATE, OP_RUNTIME_UPLOADS_CREATE, OP_RUNTIME_IMPORTS_READ, OP_RUNTIME_IMPORTS_CONFIRM]);

export function useProductStockViewModel(context: ConsoleContext, dependencies: ProductDependencies, requestStepup: () => void, onCompleted: (listing: Listing) => void) {
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing>();
  const [location, setLocation] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [safety, setSafety] = useState('0');
  const [stage, setStage] = useState<ProductRestockStage>();
  const controller = useRef<AbortController | undefined>(undefined);
  const initializedListing = useRef<string | undefined>(undefined);
  const sku = listing?.sku_id ?? '';
  const request = useMemo(
    () => Object.freeze({ scope: { kind: context.scope.kind, id: context.scope.id }, accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrf: context.session.csrf }) }),
    [context.scope.id, context.scope.kind, context.session.accessVersion, context.session.csrf]
  );
  const canOpen = STOCK_OPERATIONS.every((operation) => canUseOperation(context, operation));
  const stock = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_INVENTORY_AVAILABILITY_READ, sku],
    queryFn: ({ signal }) => dependencies.readStock.execute(request, sku, signal),
    enabled: listing !== undefined && sku !== '' && canOpen,
    staleTime: 5_000,
  });
  const item = stock.data?.items[0];
  const sources = useMemo(() => item?.sources ?? [], [item]);
  const selected = sources.find((source) => source.location === location);
  const effectiveLocation = selected?.location ?? (sources.length === 0 ? 'main' : sources[0]!.location);
  const currentOnhand = selected?.onhand ?? (sources.length === 0 ? 0 : sources[0]!.onhand);
  const reserved = selected?.reserved ?? (sources.length === 0 ? 0 : sources[0]!.reserved);
  const parsedQuantity = integer(quantity);
  const parsedSafety = integer(safety);
  const targetOnhand = currentOnhand + (parsedQuantity ?? 0);
  const targetAvailable = Math.max(0, targetOnhand - (parsedSafety ?? 0) - reserved);

  useEffect(() => {
    if (listing === undefined || stock.data === undefined || initializedListing.current === listing.id) return;
    const source = sources[0];
    setLocation(source?.location ?? 'main');
    setSafety(String(source?.safety ?? 0));
    initializedListing.current = listing.id;
  }, [listing, sources, stock.data]);
  useEffect(() => () => controller.current?.abort(), []);

  const mutation = useMutation({
    mutationFn: async () => {
      if (listing === undefined || parsedQuantity === undefined || parsedSafety === undefined) throw new Error('请填写有效的库存数量。');
      controller.current = new AbortController();
      return dependencies.restock.execute(context, { sku, location: effectiveLocation, currentOnhand, quantity: parsedQuantity, safety: parsedSafety }, setStage, controller.current.signal);
    },
    onSuccess: () => {
      setStage('completed');
      void stock.refetch();
      if (listing !== undefined) onCompleted(listing);
    },
    onSettled: () => {
      controller.current = undefined;
    },
  });

  const reset = () => {
    setListing(undefined);
    setLocation('');
    setQuantity('10');
    setSafety('0');
    setStage(undefined);
    initializedListing.current = undefined;
    mutation.reset();
  };
  const validation = validationMessage(parsedQuantity, parsedSafety);
  const queryError = stock.error === null ? undefined : presentError(stock.error).message;
  const mutationError = mutation.error === null ? undefined : presentError(mutation.error).message;
  const permissionReason = sku === '' ? '当前商品还没有可补货的规格，请先完善商品规格。' : canOpen ? undefined : '当前账号缺少查看库存、补充库存或确认库存任务的权限。';

  return Object.freeze({
    open: listing !== undefined,
    listing,
    quantity,
    safety,
    location,
    sources,
    currentOnhand,
    reserved,
    targetOnhand,
    targetAvailable,
    loading: stock.isPending && stock.isEnabled,
    busy: mutation.isPending,
    completed: stage === 'completed' && mutation.isSuccess,
    stage,
    canOpen,
    canSubmit: canOpen && sku !== '' && stock.data !== undefined && validation === undefined && !mutation.isPending,
    ...(validation === undefined ? {} : { validation }),
    ...(queryError === undefined ? {} : { queryError }),
    ...(mutationError === undefined ? {} : { error: mutationError }),
    ...(permissionReason === undefined ? {} : { permissionReason }),
    actions: Object.freeze({
      open: (value: Listing) => {
        if (!canOpen || value.sku_id === null) return;
        if (context.session.assurance.level < 2) {
          requestStepup();
          return;
        }
        mutation.reset();
        initializedListing.current = undefined;
        setStage(undefined);
        setQuantity('10');
        setSafety('0');
        setLocation('');
        setListing(value);
      },
      close: () => {
        if (!mutation.isPending) reset();
      },
      quantity: (value: string) => {
        if (!mutation.isPending) {
          setQuantity(value);
          mutation.reset();
          setStage(undefined);
        }
      },
      safety: (value: string) => {
        if (!mutation.isPending) {
          setSafety(value);
          mutation.reset();
          setStage(undefined);
        }
      },
      location: (value: string) => {
        if (!mutation.isPending) {
          const source = sources.find((candidate) => candidate.location === value);
          setLocation(value);
          setSafety(String(source?.safety ?? 0));
          mutation.reset();
          setStage(undefined);
        }
      },
      submit: () => {
        if (!canOpen || validation !== undefined || stock.data === undefined || mutation.isPending) return;
        if (context.session.assurance.level < 2) {
          requestStepup();
          return;
        }
        mutation.mutate();
      },
      retryStock: () => void stock.refetch(),
      batch: () => {
        if (listing === undefined || mutation.isPending) return;
        const pool = isManagedListing(listing) ? (listing.pool_id ?? undefined) : undefined;
        reset();
        void navigate(taskImportPath(context, 'inventory', pool));
      },
    }),
  });
}

export type ProductStockViewModel = ReturnType<typeof useProductStockViewModel>;

function integer(value: string): number | undefined {
  if (!/^(0|[1-9][0-9]{0,8})$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function validationMessage(quantity: number | undefined, safety: number | undefined): string | undefined {
  if (quantity === undefined || quantity < 1) return '本次增加数量需填写 1 到 999999999 的整数。';
  if (safety === undefined) return '安全库存需填写 0 到 999999999 的整数。';
  return undefined;
}
