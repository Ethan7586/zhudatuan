import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile, EnterpriseMall, Product, CartItem, Order, DeliveryAddress, AccountLog } from '../types';
import { productionApi, ProductionApiError } from '../services/productionApi';
import { toFrontendCategories, toFrontendOrders, toFrontendProducts } from '../adapters/frontendData';
import type { AndroidAppPage, AppMode, LaptopPage, LoginCredentials, MallContextType, MiniProgramPage, PageRoute, PendingFeatureInfo, RouteParams, SessionStatus, TabletOrientation, TabletPage, ViewportMode } from './MallContext.types';
import { useDeviceNavigation } from './useDeviceNavigation';
import { checkoutSelectedCartRequest } from './checkoutSelectedCart';
import { useProductionSync } from './useProductionSync';
import { useToasts } from './useToasts';
import { mapApiCartItems } from './mallMappers';
import { guestStorefrontProfile } from './guestStorefrontProfile';
import { EMPTY_GUEST_PROFILE, UNRESOLVED_MALL } from './productionStorefrontState';
<<<<<<< HEAD
<<<<<<< HEAD
import { storefrontAuthHref } from '../config/storefrontAuth';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { storefrontAuthHref } from '../config/storefrontAuth';
>>>>>>> 018b2a71 (chore(release): capture current production source)
export type * from './MallContext.types';
const MallContext = createContext<MallContextType | undefined>(undefined);

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
  const [products, setProducts] = useState<Product[]>(() => (showcaseService ? showcaseService.getProducts() : []));
  const [accountLogs, setAccountLogs] = useState<AccountLog[]>(() => (showcaseService ? showcaseService.getAccountLogs() : []));
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(isShowcase ? 'guest' : 'checking');
  const [catalogSyncStatus, setCatalogSyncStatus] = useState<'idle' | 'syncing' | 'ready' | 'error'>(isShowcase ? 'ready' : 'idle');
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => (showcaseService ? showcaseService.getFavorites() : []));
  const [addresses, setAddresses] = useState<DeliveryAddress[]>(() => (showcaseService ? showcaseService.getAddresses() : []));
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const sessionGenerationRef = useRef(0);
  const { toasts, showToast, removeToast } = useToasts();
  const presentationProducts = useMemo(() => toFrontendProducts(products), [products]);
  const presentationOrders = useMemo(() => toFrontendOrders(orders, presentationProducts), [orders, presentationProducts]);
  const presentationCategories = useMemo(() => toFrontendCategories(products), [products]);

  const refreshServerCart = useCallback(async () => {
    const sessionGeneration = sessionGenerationRef.current;
    const response = await productionApi.listCart();
    if (sessionGeneration !== sessionGenerationRef.current) return;
    setCart(mapApiCartItems(response.items, products));
  }, [products]);
  const refreshServerAddresses = useCallback(async () => {
    const sessionGeneration = sessionGenerationRef.current;
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
    if (sessionStatus !== 'authenticated') return;
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
  };

<<<<<<< HEAD
<<<<<<< HEAD
  const login = async (_credentials: LoginCredentials): Promise<boolean> => {
    setSessionError(null);
    window.location.assign(storefrontAuthHref());
    return false;
=======
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setSessionError(null);
    try {
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
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  const login = async (_credentials: LoginCredentials): Promise<boolean> => {
    setSessionError(null);
    window.location.assign(storefrontAuthHref());
    return false;
>>>>>>> 018b2a71 (chore(release): capture current production source)
  };
  const logout = async () => {
    const revokeRequest = productionApi.logout();
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
<<<<<<< HEAD
<<<<<<< HEAD
        const existing = cart.find((item) => item.product.id === product.id);
        await productionApi.upsertCartItem({ listingId: product.id, quantity: (existing?.quantity ?? 0) + quantity });
=======
        await productionApi.upsertCartItem({ skuId: product.skuId, quantity, selected: true });
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
        const existing = cart.find((item) => item.product.id === product.id);
        await productionApi.upsertCartItem({ listingId: product.id, quantity: (existing?.quantity ?? 0) + quantity });
>>>>>>> 018b2a71 (chore(release): capture current production source)
        await refreshServerCart();
        showToast(`已将“${product.title.slice(0, 16)}...”加入购物车`, 'success');
      } catch {
        showToast('购物车保存失败，请稍后重试', 'error');
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
<<<<<<< HEAD
<<<<<<< HEAD
      if (!item?.product.id) return;
=======
      if (!item?.product.skuId) return;
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      if (!item?.product.id) return;
>>>>>>> 018b2a71 (chore(release): capture current production source)
      if (quantity <= 0) {
        void productionApi
          .deleteCartItem(cartItemId)
          .then(refreshServerCart)
          .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      } else {
        void productionApi
<<<<<<< HEAD
<<<<<<< HEAD
          .upsertCartItem({ listingId: item.product.id, quantity })
=======
          .upsertCartItem({ skuId: item.product.skuId, quantity, selected: item.selected })
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          .upsertCartItem({ listingId: item.product.id, quantity })
>>>>>>> 018b2a71 (chore(release): capture current production source)
          .then(refreshServerCart)
          .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      }
      return;
    }
    if (showcaseService) setCart(showcaseService.updateCartQuantity(cartItemId, quantity));
  };

  const handleToggleCartItemSelected = (cartItemId: string) => {
    if (sessionStatus === 'authenticated') {
<<<<<<< HEAD
<<<<<<< HEAD
      // Canonical cart does not persist a selected flag. Selection is a UI
      // concern; checkout fails closed unless every server item is selected.
      setCart((items) => items.map((item) => (item.id === cartItemId ? { ...item, selected: !item.selected } : item)));
=======
      const item = cart.find((candidate) => candidate.id === cartItemId);
      if (!item?.product.skuId) return;
      void productionApi
        .upsertCartItem({ skuId: item.product.skuId, quantity: item.quantity, selected: !item.selected })
        .then(refreshServerCart)
        .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      // Canonical cart does not persist a selected flag. Selection is a UI
      // concern; checkout fails closed unless every server item is selected.
      setCart((items) => items.map((item) => (item.id === cartItemId ? { ...item, selected: !item.selected } : item)));
>>>>>>> 018b2a71 (chore(release): capture current production source)
      return;
    }
    if (showcaseService) setCart(showcaseService.toggleCartItemSelected(cartItemId));
  };

  const handleToggleSelectAllCart = (selected: boolean) => {
    if (sessionStatus === 'authenticated') {
<<<<<<< HEAD
<<<<<<< HEAD
      setCart((items) => items.map((item) => ({ ...item, selected })));
=======
      const updates = cart.filter((item) => item.product.skuId).map((item) => productionApi.upsertCartItem({ skuId: item.product.skuId!, quantity: item.quantity, selected }));
      void Promise.all(updates)
        .then(refreshServerCart)
        .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      setCart((items) => items.map((item) => ({ ...item, selected })));
>>>>>>> 018b2a71 (chore(release): capture current production source)
      return;
    }
    if (showcaseService) setCart(showcaseService.toggleSelectAllCart(selected));
  };

  const handleRemoveCartItem = async (cartItemId: string) => {
    if (sessionStatus === 'authenticated') {
      await productionApi
        .deleteCartItem(cartItemId)
        .then(refreshServerCart)
        .then(() => showToast('已从购物车移除该商品', 'info'))
        .catch(() => showToast('购物车更新失败，请稍后重试', 'error'));
      return;
    }
    if (showcaseService) {
      setCart(showcaseService.removeCartItem(cartItemId));
      showToast('已从展示购物车移除该商品', 'info');
    }
  };

  const checkoutSelectedCart = async (): Promise<boolean> => {
    if (sessionStatus !== 'authenticated') {
      showToast('请先登录账户，再提交订单', 'warning');
      return false;
    }
    setIsSubmittingOrder(true);
    try {
<<<<<<< HEAD
<<<<<<< HEAD
      await checkoutSelectedCartRequest(cart, addresses, user);
=======
      const { selectedItems } = await checkoutSelectedCartRequest(cart, addresses, user);
      await Promise.all(selectedItems.map((item) => productionApi.deleteCartItem(item.id)));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
      await checkoutSelectedCartRequest(cart, addresses, user);
>>>>>>> 018b2a71 (chore(release): capture current production source)
      await refreshServerCart();
      await refreshProductionData();
      showToast('订单已安全写入数据库并完成福利账户支付', 'success');
      return true;
    } catch (error) {
      const message = error instanceof ProductionApiError ? error.message : '订单服务暂时不可用';
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      // Quote/order/payment are separate authoritative operations. A late
      // payment error can occur after the order has already consumed the cart,
      // so reconcile both views before the user attempts another checkout.
      void Promise.allSettled([refreshServerCart(), refreshProductionData()]);
<<<<<<< HEAD
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
      showToast(`订单提交失败：${message}`, 'error');
      return false;
    } finally {
      setIsSubmittingOrder(false);
    }
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

  const handleAddAddress = (address: Omit<DeliveryAddress, 'id'>) => {
    if (sessionStatus === 'authenticated') {
      void productionApi
        .upsertAddress({ ...address, id: '' })
        .then(refreshServerAddresses)
        .then(() => showToast('收货地址已加密保存', 'success'))
        .catch((error) => showToast(error instanceof ProductionApiError ? error.message : '地址簿保存失败，请稍后重试', 'error'));
      return;
    }
    if (showcaseService) {
      setAddresses(showcaseService.addAddress(address));
      showToast('新增展示收货地址成功', 'success');
      return;
    }
    showToast('请先登录后再管理收货地址', 'warning');
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
        presentationCategories,
        accountLogs,
        sessionStatus,
        catalogSyncStatus,
        sessionError,
        login,
        logout,
        refreshProductionData,
        isSubmittingOrder,
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
    </MallContext.Provider>
  );
};

export const useMall = () => {
  const context = useContext(MallContext);
  if (!context) throw new Error('useMall must be used within a MallProvider');
  return context;
};
