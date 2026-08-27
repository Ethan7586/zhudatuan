import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AccountLog, CartItem, DeliveryAddress, EnterpriseMall, Order, Product, UserProfile } from '../types';
import { productionApi, type ApiProduct } from '../services/productionApi';
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

type CatalogPageLoader = typeof productionApi.listProducts;

async function loadCompleteCatalog(loadPage: CatalogPageLoader): Promise<ApiProduct[]> {
  const items = new Map<string, ApiProduct>();
  let cursor: number | null = 0;
  let pageCount = 0;

  while (cursor !== null && pageCount < 60) {
    const page = await loadPage({
      cursor,
      limit: 100,
    });
    page.items.forEach((item) => items.set(item.id, item));
    if (page.pagination.nextCursor === cursor) break;
    cursor = page.pagination.nextCursor;
    pageCount += 1;
  }
  return [...items.values()];
}

export function useProductionSync(setters: ProductionSyncSetters, enabled = true) {
  const syncVersionRef = useRef(0);

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

  const refreshPublicCatalog = async () => {
    const syncVersion = ++syncVersionRef.current;
    setters.setProducts([]);
    setters.setCatalogSyncStatus('syncing');
    try {
      const items = await loadCompleteCatalog(productionApi.listProducts);
      if (syncVersion === syncVersionRef.current) publishCatalog(items);
    } catch (error) {
      if (syncVersion === syncVersionRef.current) setters.setCatalogSyncStatus('error');
      throw error;
    }
  };

  const refreshProductionData = async () => {
    if (!enabled) return;
    const syncVersion = ++syncVersionRef.current;
    // Public products are available to every visitor. Authentication only
    // upgrades this snapshot with member pricing and purchase qualification.
    setters.setProducts([]);
    setters.setCatalogSyncStatus('syncing');
    const publisher = createCatalogPublisher(() => syncVersion === syncVersionRef.current, publishCatalog);
    const publicCatalogRequest = loadCompleteCatalog(productionApi.listProducts);
    void publicCatalogRequest.then(publisher.commitPublic).catch(() => undefined);
    let snapshot: Awaited<ReturnType<typeof productionApi.getHomeSnapshot>>;
    try {
      snapshot = await productionApi.getHomeSnapshot();
    } catch (error) {
      if (syncVersion !== syncVersionRef.current) return;
      closeMemberData();
      setters.setSessionStatus('guest');
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
    const { bootstrap, accounts, orders: orderResult, accountLedgers: ledgerResult } = snapshot;
    const welfare = accounts.items.find((account) => account.type === 'welfare');
    const meal = accounts.items.find((account) => account.type === 'meal');
    setters.setUser((previous) => ({
      ...mergeAuthenticatedMemberProfile(previous, bootstrap),
      welfareBalance: (welfare?.balanceCents ?? 0) / 100,
      mealBalance: (meal?.balanceCents ?? 0) / 100,
    }));
    const resolvedMall: EnterpriseMall = {
      id: bootstrap.scope.mallId,
      enterpriseId: bootstrap.scope.enterpriseId,
      enterpriseName: bootstrap.scope.enterpriseName,
      mallName: bootstrap.scope.mallName,
      logoText: bootstrap.scope.brandName,
      badge: '企业福利专享',
      welcomeBanner: `${bootstrap.scope.enterpriseName}员工福利商城已开放，实际权益以企业发放为准。`,
    };
    setters.setCurrentMall(resolvedMall);
    setters.setMalls([resolvedMall]);
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
    // Account identity, balances and orders are enough to make the shell
    // interactive. The qualified catalog is heavier and can finish in the
    // background without hiding account actions such as logout.
    setters.setSessionStatus('authenticated');
    void loadCompleteCatalog(productionApi.listQualifiedProducts)
      .then(publisher.commitQualified)
      .catch(async () => {
        try {
          await publicCatalogRequest;
        } catch {
          if (syncVersion === syncVersionRef.current && !publisher.hasPublicFallback()) setters.setCatalogSyncStatus('error');
        }
      });
  };

  const cancelProductionSync = () => {
    syncVersionRef.current += 1;
    setters.setCatalogSyncStatus('idle');
  };

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // /home is both the authorization check and the initial data snapshot.
    // Avoid a separate /auth/session round trip before loading the page.
    void refreshProductionData().catch(() => {
      if (active) setters.setSessionStatus('guest');
    });
    return () => {
      active = false;
      syncVersionRef.current += 1;
    };
  }, [enabled]);

  return { refreshProductionData, refreshPublicCatalog, cancelProductionSync };
}
