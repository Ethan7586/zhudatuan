import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AccountLog, CartItem, DeliveryAddress, EnterpriseMall, Order, Product, UserProfile } from '../types';
import { ProductionApiError } from '../services/productionApi.error';
import type { ApiBootstrap, ApiHomeSnapshot, ApiProduct } from '../services/productionApi.types';
import { listPublicProducts, type PublicCatalogOptions } from '../services/publicCatalogApi';
import { loadProductionApi } from '../services/productionApiLoader';
import { mapApiOrder, mapApiProduct } from './mallMappers';
import type { CatalogSyncStatus, SessionStatus } from './MallContext.types';
import { EMPTY_GUEST_PROFILE, UNRESOLVED_MALL } from './productionStorefrontState';
import { mergeAuthenticatedMemberProfile } from './storefrontMemberProfile';
import { createCatalogPublisher } from './catalogSync';

interface ProductionSyncSetters {
  setProducts: Dispatch<SetStateAction<Product[]>>;
  setUser: Dispatch<SetStateAction<UserProfile>>;
  setCurrentMall: Dispatch<SetStateAction<EnterpriseMall>>;
  setMalls: Dispatch<SetStateAction<EnterpriseMall[]>>;
  setOrders: Dispatch<SetStateAction<Order[]>>;
  setAccountLogs: Dispatch<SetStateAction<AccountLog[]>>;
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  setAddresses: Dispatch<SetStateAction<DeliveryAddress[]>>;
  setFavorites: Dispatch<SetStateAction<string[]>>;
  setQuickViewProduct: Dispatch<SetStateAction<Product | null>>;
  setSessionStatus: Dispatch<SetStateAction<SessionStatus>>;
  setCatalogSyncStatus: Dispatch<SetStateAction<CatalogSyncStatus>>;
}

type CatalogPageLoader = (options?: PublicCatalogOptions) => Promise<{ items: ApiProduct[]; pagination: { nextCursor: string | null } }>;

async function loadCompleteCatalog(loadPage: CatalogPageLoader): Promise<ApiProduct[]> {
  const items = new Map<string, ApiProduct>();
  let cursor: string | undefined;

  for (let pageCount = 0; pageCount < 60; pageCount += 1) {
    const page = await loadPage({
      ...(cursor ? { cursor } : {}),
      limit: 100,
    });
    page.items.forEach((item) => items.set(item.id, item));
    if (!page.pagination.nextCursor || page.pagination.nextCursor === cursor) break;
    cursor = page.pagination.nextCursor;
  }
  return [...items.values()];
}

export function shouldRetainProductionSnapshot(error: unknown): boolean {
  return error instanceof ProductionApiError && error.status === 0;
}

export function shouldCloseMemberSession(error: unknown): boolean {
  return error instanceof ProductionApiError && (error.status === 401 || error.status === 403);
}

export function authenticatedMall(bootstrap: ApiBootstrap): EnterpriseMall {
  return {
    id: bootstrap.scope.mallId,
    enterpriseId: bootstrap.scope.enterpriseId,
    enterpriseName: bootstrap.scope.enterpriseName,
    mallName: bootstrap.scope.mallName,
    logoText: bootstrap.scope.brandName,
    badge: '企业福利专享',
    welcomeBanner: `${bootstrap.scope.enterpriseName}员工福利商城已开放，实际权益以企业发放为准。`,
  };
}

export function useProductionSync(setters: ProductionSyncSetters, enabled = true) {
  const syncVersionRef = useRef(0);
  const productionRefreshRef = useRef<Promise<void> | null>(null);

  const closeMemberData = () => {
    setters.setUser({ ...EMPTY_GUEST_PROFILE });
    setters.setCurrentMall({ ...UNRESOLVED_MALL });
    setters.setMalls([]);
    setters.setOrders([]);
    setters.setAccountLogs([]);
    setters.setCart([]);
    setters.setAddresses([]);
    setters.setFavorites([]);
    setters.setQuickViewProduct(null);
  };

  const publishCatalog = (items: ApiProduct[]) => {
    setters.setProducts(items.map(mapApiProduct));
    setters.setCatalogSyncStatus('ready');
  };

  const publishMemberShell = (bootstrap: ApiBootstrap) => {
    const resolvedMall = authenticatedMall(bootstrap);
    setters.setUser((previous) => mergeAuthenticatedMemberProfile(previous, bootstrap));
    setters.setCurrentMall(resolvedMall);
    setters.setMalls([resolvedMall]);
    setters.setSessionStatus('authenticated');
  };

  const refreshPublicCatalog = async () => {
    const syncVersion = ++syncVersionRef.current;
    setters.setCatalogSyncStatus('syncing');
    try {
      const items = await loadCompleteCatalog(listPublicProducts);
      if (syncVersion === syncVersionRef.current) publishCatalog(items);
    } catch (error) {
      if (syncVersion === syncVersionRef.current) setters.setCatalogSyncStatus('error');
      throw error;
    }
  };

  const runProductionRefresh = async () => {
    if (!enabled) return;
    const syncVersion = ++syncVersionRef.current;
    // Public products are available to every visitor. Authentication only
    // upgrades this snapshot with member pricing and purchase qualification.
    setters.setCatalogSyncStatus('syncing');
    const publisher = createCatalogPublisher(() => syncVersion === syncVersionRef.current, publishCatalog);
    const publicCatalogRequest = loadCompleteCatalog(listPublicProducts);
    const productionApiRequest = loadProductionApi();
    void publicCatalogRequest.then(publisher.commitPublic).catch(() => undefined);
    let bootstrap: ApiBootstrap;
    try {
      const productionApi = await productionApiRequest;
      bootstrap = (await productionApi.getSession()).bootstrap;
    } catch (error) {
      if (syncVersion !== syncVersionRef.current) return;
      if (!shouldRetainProductionSnapshot(error)) {
        closeMemberData();
        setters.setSessionStatus('guest');
      } else {
        setters.setSessionStatus((current) => current === 'checking' ? 'guest' : current);
      }
      try {
        publisher.commitPublic(await publicCatalogRequest);
      } catch {
        if (syncVersion === syncVersionRef.current) setters.setCatalogSyncStatus('error');
      }
      throw error;
    }
    if (syncVersion !== syncVersionRef.current) {
      void publicCatalogRequest.catch(() => undefined);
      return;
    }
    // Identity and the stable shell are ready before balances, orders and
    // ledgers. Slow account APIs must never keep the page in a guest frame.
    publishMemberShell(bootstrap);

    let snapshot: ApiHomeSnapshot;
    try {
      const productionApi = await productionApiRequest;
      snapshot = await productionApi.getHomeSnapshot(bootstrap);
    } catch (error) {
      if (syncVersion !== syncVersionRef.current) return;
      if (shouldCloseMemberSession(error)) {
        closeMemberData();
        setters.setSessionStatus('guest');
      }
      try {
        publisher.commitPublic(await publicCatalogRequest);
      } catch {
        if (syncVersion === syncVersionRef.current) setters.setCatalogSyncStatus('error');
      }
      throw error;
    }
    if (syncVersion !== syncVersionRef.current) return;

    const { accounts, orders: orderResult, accountLedgers: ledgerResult } = snapshot;
    const welfare = accounts.items.find((account) => account.type === 'welfare');
    const meal = accounts.items.find((account) => account.type === 'meal');
    setters.setUser((previous) => ({
      ...previous,
      welfareBalance: (welfare?.balanceCents ?? 0) / 100,
      mealBalance: (meal?.balanceCents ?? 0) / 100,
    }));
    setters.setOrders(orderResult.items.map((order) => mapApiOrder(order, bootstrap.scope)));
    setters.setAccountLogs(
      ledgerResult.items.map((ledger) => ({
        id: ledger.id,
        accountType: ledger.accountType,
        title: ledger.businessType === 'order_payment' ? '商城订单账户支付' : ledger.businessType === 'refund' ? '售后退款原路退回' : '企业福利额度发放',
        amount: ((ledger.direction === 'credit' ? 1 : -1) * ledger.amountCents) / 100,
        direction: ledger.direction === 'credit' ? 'in' : 'out',
        orderNo: ledger.orderNo ?? undefined,
        time: new Date(ledger.createdAt).toLocaleString('zh-CN', {
          hour12: false,
        }),
        balanceAfter: ledger.balanceAfterCents / 100,
      }))
    );
    // The qualified catalog is heavier and can finish after the member shell.
    void productionApiRequest.then((productionApi) => loadCompleteCatalog(productionApi.listQualifiedProducts))
      .then(publisher.commitQualified)
      .catch(async () => {
        try {
          await publicCatalogRequest;
        } catch {
          if (syncVersion === syncVersionRef.current && !publisher.hasPublicFallback()) setters.setCatalogSyncStatus('error');
        }
      });
  };

  const refreshProductionData = (): Promise<void> => {
    if (!enabled) return Promise.resolve();
    const activeRefresh = productionRefreshRef.current;
    if (activeRefresh) return activeRefresh;
    const refresh = runProductionRefresh();
    productionRefreshRef.current = refresh;
    refresh.then(
      () => {
        if (productionRefreshRef.current === refresh) productionRefreshRef.current = null;
      },
      () => {
        if (productionRefreshRef.current === refresh) productionRefreshRef.current = null;
      }
    );
    return refresh;
  };

  const cancelProductionSync = () => {
    syncVersionRef.current += 1;
    setters.setCatalogSyncStatus('idle');
  };

  useEffect(() => {
    if (!enabled) return;
    // Publish identity first; balances, orders and catalog continue without
    // blocking the first authenticated frame.
    void refreshProductionData().catch(() => undefined);
    const handleOnline = () => {
      void refreshProductionData().catch(() => undefined);
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      syncVersionRef.current += 1;
      productionRefreshRef.current = null;
    };
  }, [enabled]);

  return { refreshProductionData, refreshPublicCatalog, cancelProductionSync };
}
