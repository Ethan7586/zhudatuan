import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile, EnterpriseMall, Product, CartItem, Order, DeliveryAddress, AccountLog } from '../types';
import { ProductionApiError } from '../services/productionApi.error';
import { loadProductionApi } from '../services/productionApiLoader';
import { toFrontendCategories, toFrontendOrders, toFrontendProducts } from '../adapters/frontendData';
import type { AndroidAppPage, AppMode, LaptopPage, LoginCredentials, MallContextType, MiniProgramPage, MobileFulfillmentStage, PageRoute, PendingFeatureInfo, RouteParams, SessionStatus, TabletOrientation, TabletPage, ViewportMode } from './MallContext.types';
import { useDeviceNavigation } from './useDeviceNavigation';
import { checkoutSelectedCartRequest, PaymentPhoneVerificationRequired } from './checkoutSelectedCart';
import { useProductionSync } from './useProductionSync';
import { useToasts } from './useToasts';
import { mapApiCartItems } from './mallMappers';
import { guestStorefrontProfile } from './guestStorefrontProfile';
import { EMPTY_GUEST_PROFILE, UNRESOLVED_MALL } from './productionStorefrontState';
import { createCartQuantitySync, type CartQuantitySync } from './cartQuantitySync';
export type * from './MallContext.types';
const MallContext = createContext<MallContextType | undefined>(undefined);
const PaymentPhoneVerificationModal = React.lazy(() => import('../components/mobile/PaymentPhoneVerificationModal').then(({ PaymentPhoneVerificationModal }) => ({ default: PaymentPhoneVerificationModal })));

type ShowcaseService = {
  getUserProfile: () => UserProfile;
  getCurrentMall: () => EnterpriseMall;
  getMalls: () => EnterpriseMall[];
  getProducts: () => Product[];
  getOrders: () => Order[];
  getAccountLogs: () => AccountLog[];
  getCart: () => CartItem[];
  getFavorites: () => string[];
  getAddresses: () => DeliveryAddress[];
  switchMall: (mallId: string) => EnterpriseMall;
  addToCart: (product: Product, quantity?: number, selectedSpec?: Record<string, string>) => CartItem[];
  updateCartQuantity: (cartItemId: string, quantity: number) => CartItem[];
  toggleCartItemSelected: (cartItemId: string) => CartItem[];
  toggleSelectAllCart: (selected: boolean) => CartItem[];
  removeCartItem: (cartItemId: string) => CartItem[];
  toggleFavorite: (productId: string) => boolean;
  addAddress: (address: Omit<DeliveryAddress, 'id'>) => DeliveryAddress[];
};

type MallProviderProps = {
  children: React.ReactNode;
  /** Only the isolated /[device] visual showcase may inject local demo data. */
  showcaseService?: ShowcaseService;
  /** Keeps the server and browser on the same first-render device mode. */
  initialPath?: string;
};

export const MallProvider: React.FC<MallProviderProps> = ({ children, showcaseService, initialPath }) => {
  const navigation = useDeviceNavigation(initialPath);
  const isShowcase = Boolean(showcaseService);

  const [user, setUser] = useState<UserProfile>(() => (showcaseService ? showcaseService.getUserProfile() : { ...EMPTY_GUEST_PROFILE }));
  const [currentMall, setCurrentMall] = useState<EnterpriseMall>(() => (showcaseService ? showcaseService.getCurrentMall() : { ...UNRESOLVED_MALL }));
  const [malls, setMalls] = useState<EnterpriseMall[]>(() => (showcaseService ? showcaseService.getMalls() : []));
  const [cart, setCart] = useState<CartItem[]>(() => (showcaseService ? showcaseService.getCart() : []));
  const [orders, setOrders] = useState<Order[]>(() => (showcaseService ? showcaseService.getOrders() : []));
  const [mobileFulfillmentSimulationStage, setMobileFulfillmentSimulationStage] = useState<MobileFulfillmentStage | null>(null);
  const [products, setProducts] = useState<Product[]>(() => (showcaseService ? showcaseService.getProducts() : []));
  const [accountLogs, setAccountLogs] = useState<AccountLog[]>(() => (showcaseService ? showcaseService.getAccountLogs() : []));
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(isShowcase ? 'authenticated' : 'checking');
  const [catalogSyncStatus, setCatalogSyncStatus] = useState<'idle' | 'syncing' | 'ready' | 'error'>(isShowcase ? 'ready' : 'idle');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [paymentPhoneVerificationOpen, setPaymentPhoneVerificationOpen] = useState(false);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>(() => (showcaseService ? showcaseService.getFavorites() : []));
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(() => (showcaseService ? showcaseService.getAddresses() : []));
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const sessionGenerationRef = useRef(0);
  const { toasts, showToast, removeToast } = useToasts();
  const showToastRef = useRef(showToast);
  const refreshServerCartRef = useRef<() => Promise<void>>(async () => undefined);
  const cartQuantitySyncRef = useRef<CartQuantitySync | null>(null);
  const productsRef = useRef(products);
  showToastRef.current = showToast;
  productsRef.current = products;
  const presentationProducts = useMemo(() => toFrontendProducts(products), [products]);
  const presentationOrders = useMemo(() => toFrontendOrders(orders, presentationProducts), [orders, presentationProducts]);
  const presentationCategories = useMemo(() => toFrontendCategories(products), [products]);

  const refreshServerCart = useCallback(async () => {
    const sessionGeneration = sessionGenerationRef.current;
    const productionApi = await loadProductionApi();
    const response = await productionApi.listCart();
    if (sessionGeneration !== sessionGenerationRef.current) return;
    setCart(mapApiCartItems(response.items, productsRef.current));
  }, []);
  refreshServerCartRef.current = refreshServerCart;
  if (!cartQuantitySyncRef.current) {
    cartQuantitySyncRef.current = createCartQuantitySync(
      async ({ listingId, quantity }) => {
        const productionApi = await loadProductionApi();
        await productionApi.upsertCartItem({ listingId, quantity });
      },
      () => {
        showToastRef.current('购物车更新失败，请稍后重试', 'error');
      }
    );
  }
  useEffect(() => () => cartQuantitySyncRef.current?.cancel(), []);
  const refreshServerAddresses = useCallback(async () => {
    const sessionGeneration = sessionGenerationRef.current;
    const productionApi = await loadProductionApi();
    const response = await productionApi.listAddresses();
    if (sessionGeneration === sessionGenerationRef.current) setAddresses(response.items);
  }, []);
  const { refreshProductionData, refreshPublicCatalog, cancelProductionSync } = useProductionSync(
    {
      setProducts,
      setUser,
      setCurrentMall,
      setMalls,
      setOrders,
      setAccountLogs,
      setCart,
      setAddresses,
      setFavorites,
      setQuickViewProduct,
      setSessionStatus,
      setCatalogSyncStatus,
    },
    !isShowcase
  );
  useEffect(() => {
    if (sessionStatus !== 'authenticated') {
      cartQuantitySyncRef.current?.cancel();
      return;
    }
    setFavorites([]);
    // Cart and addresses are non-critical for the first view. Defer their
    // network work until the storefront is interactive instead of delaying a
    // refresh behind two more cross-region authorization round trips.
    const timer = window.setTimeout(() => {
      void refreshServerCart().catch(() => showToast('购物车同步失败，请稍后重试', 'error'));
      void refreshServerAddresses().catch(() => showToast('地址簿同步失败，请稍后重试', 'error'));
    }, 1_500);
    return () => window.clearTimeout(timer);
  }, [sessionStatus, refreshServerCart, refreshServerAddresses, showToast]);
  const refreshUserData = () => {
    if (sessionStatus === 'authenticated') {
      void refreshProductionData().catch(() => {
        showToast('账户数据同步失败，请稍后重试', 'error');
      });
      return;
    }
    if (showcaseService) {
      setUser(showcaseService.getUserProfile());
      setCurrentMall(showcaseService.getCurrentMall());
      setProducts(showcaseService.getProducts());
      setOrders(showcaseService.getOrders());
      return;
    }
    setUser(guestStorefrontProfile());
    setCurrentMall({ ...UNRESOLVED_MALL });
    setMalls([]);
    void refreshPublicCatalog().catch(() => showToast('公开商品目录同步失败，请稍后重试', 'error'));
    setCart([]);
    setOrders([]);
    setMobileFulfillmentSimulationStage(null);
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setSessionError(null);
    try {
      const productionApi = await loadProductionApi();
      await productionApi.login(credentials);
      await refreshProductionData();
      showToast('安全登录成功，已同步福利账户与订单', 'success');
      return true;
    } catch (error) {
      const message = error instanceof ProductionApiError ? error.message : '登录服务暂时不可用';
      setSessionStatus('guest');
      setSessionError(message);
      return false;
    }
  };
  const logout = async () => {
    const revokeRequest = loadProductionApi().then((productionApi) => productionApi.logout());
    cartQuantitySyncRef.current?.cancel();
    sessionGenerationRef.current += 1;
    cancelProductionSync();
    setSessionStatus('guest');
    setSessionError(null);
    setUser(guestStorefrontProfile());
    setCurrentMall({ ...UNRESOLVED_MALL });
    setMalls([]);
    setProducts([]);
    setCart([]);
    setOrders([]);
    setAccountLogs([]);
    setFavorites([]);
    setAddresses([]);
    setQuickViewProduct(null);
    navigation.navigateTo('home');
    showToast('已退出登录，服务器会话正在安全撤销', 'info');
    try {
      await revokeRequest;
    } catch {
      showToast('页面已退出；服务器会话撤销失败，请刷新页面确认', 'warning');
    }
    void refreshPublicCatalog().catch(() => showToast('公开商品目录同步失败，请稍后重试', 'error'));
  };

  const switchMall = (mallId: string) => {
    if (showcaseService) {
      const newMall = showcaseService.switchMall(mallId);
      setCurrentMall(newMall);
      setUser(showcaseService.getUserProfile());
      setProducts(showcaseService.getProducts());
      setCart(showcaseService.getCart());
      setOrders(showcaseService.getOrders());
      setFavorites(showcaseService.getFavorites());
      setAddresses(showcaseService.getAddresses());
      navigation.navigateTo('home');
      showToast(`已切换至【${newMall.mallName}】`, 'info');
      return;
    }
    if (sessionStatus === 'authenticated' && mallId !== currentMall.id) {
      showToast('当前账号未获得其他商城的数据权限', 'warning');
      return;
    }
    showToast('请先登录并获取企业商城访问权限', 'warning');
  };

  const handleAddToCart = async (product: Product, quantity = 1, selectedSpec: Record<string, string> = {}) => {
    if (product.isTest) {
      showToast('测试商品仅用于系统验证，不能加入购物车', 'warning');
      return;
    }
    if (sessionStatus !== 'authenticated' && !showcaseService) {
      showToast('商品可以直接浏览；登录后才能确认会员价与加入购物车', 'warning');
      return;
    }
    if (product.purchasable === false) {
      showToast(product.qualificationReason === 'PURCHASE_LIMIT_EXCEEDED' ? '已达到该商品的限购上限' : '当前资格或城市暂不能购买该商品', 'warning');
      return;
    }
    if (sessionStatus === 'authenticated' && product.skuId) {
      try {
        const productionApi = await loadProductionApi();
        await productionApi.upsertCartItem({ listingId: product.id, quantity });
      } catch {
        showToast('购物车保存失败，请稍后重试', 'error');
        return;
      }
      try {
        await refreshServerCart();
        showToast(`已将“${product.title.slice(0, 16)}...”加入购物车`, 'success');
      } catch {
        showToast('商品已加入，但购物车读取失败，请刷新后重试', 'error');
      }
      return;
    }
    if (sessionStatus === 'authenticated') {
      showToast('商品资格正在后台同步，请稍后再加入购物车', 'info');
      return;
    }
    if (showcaseService) {
      setCart(showcaseService.addToCart(product, quantity, selectedSpec));
      showToast(`已将“${product.title.slice(0, 16)}...”加入展示购物车`, 'success');
      return;
    }
    showToast('请先登录后再加入购物车', 'warning');
  };

  const handleUpdateCartQuantity = (cartItemId: string, quantity: number) => {
    if (sessionStatus === 'authenticated') {
      const item = cart.find((candidate) => candidate.id === cartItemId);
      if (!item?.product.skuId || !Number.isSafeInteger(quantity)) return;
      const nextQuantity = Math.max(0, quantity);
      setCart((current) => nextQuantity === 0
        ? current.filter((candidate) => candidate.id !== cartItemId)
        : current.map((candidate) => candidate.id === cartItemId ? { ...candidate, quantity: nextQuantity } : candidate));
      cartQuantitySyncRef.current?.schedule({
        cartItemId,
        listingId: item.product.id,
        quantity: nextQuantity,
      });
      return;
    }
    if (showcaseService) setCart(showcaseService.updateCartQuantity(cartItemId, quantity));
  };

  const handleToggleCartItemSelected = (cartItemId: string) => {
    if (sessionStatus === 'authenticated') {
      setCart((current) => current.map((item) => (
        item.id === cartItemId ? { ...item, selected: !item.selected } : item
      )));
      return;
    }
    if (showcaseService) setCart(showcaseService.toggleCartItemSelected(cartItemId));
  };

  const handleToggleSelectAllCart = (selected: boolean) => {
    if (sessionStatus === 'authenticated') {
      setCart((current) => current.map((item) => ({ ...item, selected })));
      return;
    }
    if (showcaseService) setCart(showcaseService.toggleSelectAllCart(selected));
  };

  const handleRemoveCartItem = async (cartItemId: string) => {
    if (sessionStatus === 'authenticated') {
      const item = cart.find((candidate) => candidate.id === cartItemId);
      if (!item?.product.skuId) return;
      setCart((current) => current.filter((candidate) => candidate.id !== cartItemId));
      cartQuantitySyncRef.current?.schedule({ cartItemId, listingId: item.product.id, quantity: 0 });
      await cartQuantitySyncRef.current?.flush()
        .then(() => showToast('已从购物车移除该商品', 'info'))
        .catch(() => refreshServerCartRef.current().catch(() => undefined));
      return;
    }
    if (showcaseService) {
      setCart(showcaseService.removeCartItem(cartItemId));
      showToast('已从展示购物车移除该商品', 'info');
    }
  };

  const submitSelectedCart = async (checkoutUser: UserProfile): Promise<boolean> => {
    if (sessionStatus !== 'authenticated') {
      showToast('请先登录账户，再提交订单', 'warning');
      return false;
    }
    setIsSubmittingOrder(true);
    try {
      await cartQuantitySyncRef.current?.flush();
      const checkout = await checkoutSelectedCartRequest(cart, addresses, checkoutUser);
      const { selectedItems } = checkout;
      setActivePaymentId(checkout.paymentId);
      const productionApi = await loadProductionApi();
      await Promise.all(selectedItems.map((item) => productionApi.deleteCartItem(item.id)));
      await refreshServerCart();
      await refreshProductionData();
      if (checkout.paymentState === 'captured') showToast('订单已写入数据库并完成支付', 'success');
      else if (checkout.paymentState === 'reconciling') showToast('订单已创建，支付渠道结果正在自动核验', 'info');
      else showToast('微信支付已提交，订单正在确认到账', 'info');
      return true;
    } catch (error) {
      if (error instanceof PaymentPhoneVerificationRequired) {
        setPaymentPhoneVerificationOpen(true);
        return false;
      }
      const message = error instanceof Error ? error.message : '订单服务暂时不可用';
      showToast(`订单提交失败：${message}`, 'error');
      return false;
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const checkoutSelectedCart = (): Promise<boolean> => submitSelectedCart(user);

  const completePaymentPhoneVerification = async (): Promise<void> => {
    const verifiedUser: UserProfile = {
      ...user,
      assuranceLevel: 'phone',
      phoneVerified: true,
      paymentEligible: true,
    };
    setUser(verifiedUser);
    setPaymentPhoneVerificationOpen(false);
    await submitSelectedCart(verifiedUser);
  };

  const handleToggleFavorite = (productId: string) => {
    if (sessionStatus === 'authenticated') return void showToast('收藏功能即将开放', 'info');
    if (showcaseService) {
      const isFav = showcaseService.toggleFavorite(productId);
      setFavorites(showcaseService.getFavorites());
      showToast(isFav ? '已加入展示收藏夹' : '已取消展示收藏', isFav ? 'success' : 'info');
      return;
    }
    showToast('请先登录后再使用收藏功能', 'warning');
  };

  const handleAddAddress = async (address: Omit<DeliveryAddress, 'id'>): Promise<boolean> => {
    if (sessionStatus === 'authenticated') {
      try {
        const productionApi = await loadProductionApi();
        await productionApi.upsertAddress({ ...address, id: '' });
        await refreshServerAddresses();
        showToast('收货地址已加密保存', 'success');
        return true;
      } catch (error) {
        showToast(error instanceof ProductionApiError ? error.message : '地址簿保存失败，请稍后重试', 'error');
        return false;
      }
    }
    if (showcaseService) {
      setAddresses(showcaseService.addAddress(address));
      showToast('新增展示收货地址成功', 'success');
      return true;
    }
    showToast('请先登录后再管理收货地址', 'warning');
    return false;
  };

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <MallContext.Provider
      value={{
        ...navigation,
        user,
        currentMall,
        malls,
        switchMall,
        refreshUserData,
        orders,
        products,
        presentationProducts,
        presentationOrders,
        mobileFulfillmentSimulationStage,
        setMobileFulfillmentSimulationStage,
        presentationCategories,
        accountLogs,
        sessionStatus,
        catalogSyncStatus,
        sessionError,
        login,
        logout,
        refreshProductionData,
        isSubmittingOrder,
        activePaymentId,
        closePaymentResult: () => setActivePaymentId(null),
        checkoutSelectedCart,
        cart,
        cartCount,
        addToCart: handleAddToCart,
        updateCartQuantity: handleUpdateCartQuantity,
        toggleCartItemSelected: handleToggleCartItemSelected,
        toggleSelectAllCart: handleToggleSelectAllCart,
        removeCartItem: handleRemoveCartItem,
        favorites,
        toggleFavorite: handleToggleFavorite,
        addresses,
        addAddress: handleAddAddress,
        toasts,
        showToast,
        removeToast,
        quickViewProduct,
        setQuickViewProduct,
      }}
    >
      {children}
      {paymentPhoneVerificationOpen && sessionStatus === 'authenticated' && (
        <React.Suspense fallback={null}>
          <PaymentPhoneVerificationModal
            phone={user.phone}
            onClose={() => setPaymentPhoneVerificationOpen(false)}
            onVerified={completePaymentPhoneVerification}
          />
        </React.Suspense>
      )}
    </MallContext.Provider>
  );
};

export const useMall = () => {
  const context = useContext(MallContext);
  if (!context) throw new Error('useMall must be used within a MallProvider');
  return context;
};
