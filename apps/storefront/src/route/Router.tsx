import { Navigate, Route, Routes as BrowserRoutes, useLocation, useNavigate, useParams } from 'react-router';
import { lazy, Suspense } from 'react';
import type { LaptopPage } from '../shared/manifest/StorefrontRoute';
import { ChannelChrome } from '../shell/ChannelChrome';
import { useViewportKind } from '../shared/ui/Viewport';
import { Guard } from './Guard';
import { ROUTES, routeForPage } from './Routes';
import { Scroll } from './Scroll';

const DesktopHome = lazy(() => import('../feature/home/ui/LaptopHomePage1366').then(({ LaptopHomePage1366 }) => ({ default: LaptopHomePage1366 })));
const WideDesktopHome = lazy(() => import('../feature/home/ui/LaptopHomePage1440').then(({ LaptopHomePage1440 }) => ({ default: LaptopHomePage1440 })));
const MobileHome = lazy(() => import('../feature/home/ui/MobileHomePage').then(({ MobileHomePage }) => ({ default: MobileHomePage })));
const TabletHome = lazy(() => import('../feature/home/ui/TabletHomePage').then(({ TabletHomePage }) => ({ default: TabletHomePage })));
const DesktopCatalog = lazy(() => import('../feature/catalog/ui/LaptopCategoryPage').then(({ LaptopCategoryPage }) => ({ default: LaptopCategoryPage })));
const MobileCatalog = lazy(() => import('../feature/catalog/ui/MobileCatalogPage').then(({ MobileCatalogPage }) => ({ default: MobileCatalogPage })));
const TabletCatalog = lazy(() => import('../feature/catalog/ui/TabletCatalogPage').then(({ TabletCatalogPage }) => ({ default: TabletCatalogPage })));
const DesktopProduct = lazy(() => import('../feature/product/ui/LaptopDetailPage').then(({ LaptopDetailPage }) => ({ default: LaptopDetailPage })));
const MobileProduct = lazy(() => import('../feature/product/ui/MobileProductPage').then(({ MobileProductPage }) => ({ default: MobileProductPage })));
const TabletProduct = lazy(() => import('../feature/product/ui/TabletProductPage').then(({ TabletProductPage }) => ({ default: TabletProductPage })));
const DesktopCheckout = lazy(() => import('../feature/checkout/ui/CheckoutPage').then(({ CheckoutPage }) => ({ default: CheckoutPage })));
const MobileCart = lazy(() => import('../feature/cart/ui/MobileCartPage').then(({ MobileCartPage }) => ({ default: MobileCartPage })));
const TabletCart = lazy(() => import('../feature/cart/ui/TabletCartPage').then(({ TabletCartPage }) => ({ default: TabletCartPage })));
const DesktopOrders = lazy(() => import('../feature/order/ui/LaptopOrdersPage').then(({ LaptopOrdersPage }) => ({ default: LaptopOrdersPage })));
const MobileAccount = lazy(() => import('../feature/account/ui/MobileAccountPage').then(({ MobileAccountPage }) => ({ default: MobileAccountPage })));
const TabletOrders = lazy(() => import('../feature/order/ui/TabletOrdersPage').then(({ TabletOrdersPage }) => ({ default: TabletOrdersPage })));
const OrderDetail = lazy(() => import('../feature/order/ui/OrderDetailPage').then(({ OrderDetailPage }) => ({ default: OrderDetailPage })));
const AfterSale = lazy(() => import('../feature/aftersale/ui/AfterSalePage').then(({ AfterSalePage }) => ({ default: AfterSalePage })));
const Notifications = lazy(() => import('../feature/notification/ui/NotificationPage').then(({ NotificationPage }) => ({ default: NotificationPage })));
const Support = lazy(() => import('../feature/support/ui/SupportPage').then(({ SupportPage }) => ({ default: SupportPage })));
const Conversation = lazy(() => import('../feature/support/ui/ConversationPage').then(({ ConversationPage }) => ({ default: ConversationPage })));
const Security = lazy(() => import('../feature/security/ui/SecurityPage').then(({ SecurityPage }) => ({ default: SecurityPage })));
const Vouchers = lazy(() => import('../feature/voucher/ui/VoucherPage').then(({ VoucherPage }) => ({ default: VoucherPage })));
const Benefits = lazy(() => import('../feature/benefit/ui/BenefitPage').then(({ BenefitPage }) => ({ default: BenefitPage })));
const PaymentResult = lazy(() => import('../feature/payment/ui/PaymentResultPage').then(({ PaymentResultPage }) => ({ default: PaymentResultPage })));
const Invoices = lazy(() => import('../feature/order/ui/InvoicePanel').then(({ InvoicePanel }) => ({ default: InvoicePanel })));

export function Router() {
  return (
    <>
      <Scroll />
      <BrowserRoutes>
        <Route path={ROUTES.home} element={<Page kind="home" />} />
        <Route path={ROUTES.products} element={<Page kind="catalog" />} />
        <Route path={ROUTES.product} element={<Page kind="product" />} />
        <Route
          path={ROUTES.cart}
          element={
            <Protected>
              <Page kind="cart" />
            </Protected>
          }
        />
        <Route
          path={ROUTES.checkout}
          element={
            <Protected>
              <Page kind="checkout" />
            </Protected>
          }
        />
        <Route
          path={ROUTES.payment}
          element={
            <Protected>
              <Frame>
                <PaymentResult />
              </Frame>
            </Protected>
          }
        />
        <Route
          path={ROUTES.orders}
          element={
            <Protected>
              <Page kind="orders" />
            </Protected>
          }
        />
        <Route
          path={ROUTES.order}
          element={
            <Protected>
              <Frame>
                <OrderDetail />
              </Frame>
            </Protected>
          }
        />
        <Route
          path={ROUTES.aftersale}
          element={
            <Protected>
              <AfterSaleRoute />
            </Protected>
          }
        />
        <Route
          path={ROUTES.vouchers}
          element={
            <Protected>
              <Frame>
                <Vouchers />
              </Frame>
            </Protected>
          }
        />
        <Route
          path={ROUTES.benefits}
          element={
            <Protected>
              <Frame>
                <Benefits />
              </Frame>
            </Protected>
          }
        />
        <Route
          path={ROUTES.profile}
          element={
            <Protected>
              <Page kind="account" />
            </Protected>
          }
        />
        <Route
          path={ROUTES.security}
          element={
            <Protected>
              <Frame>
                <Security />
              </Frame>
            </Protected>
          }
        />
        <Route
          path={ROUTES.support}
          element={
            <Protected>
              <Frame>
                <Support />
              </Frame>
            </Protected>
          }
        />
        <Route
          path={ROUTES.supportCase}
          element={
            <Protected>
              <SupportCaseRoute />
            </Protected>
          }
        />
        <Route
          path={ROUTES.notifications}
          element={
            <Protected>
              <Frame>
                <Notifications />
              </Frame>
            </Protected>
          }
        />
        <Route path="*" element={<Navigate replace to={ROUTES.home} />} />
      </BrowserRoutes>
    </>
  );
}

function Protected({ children }: { readonly children: React.ReactNode }) {
  return <Guard>{children}</Guard>;
}

function Frame({ children }: { readonly children: React.ReactNode }) {
  return (
    <ChannelChrome>
      <Suspense
        fallback={
          <main role="status" className="storefrontloading">
            正在加载页面…
          </main>
        }
      >
        {children}
      </Suspense>
    </ChannelChrome>
  );
}

function Page({ kind }: { readonly kind: 'home' | 'catalog' | 'product' | 'cart' | 'checkout' | 'orders' | 'account' }) {
  const viewport = useViewportKind();
  const navigate = useNavigate();
  const location = useLocation();
  const select = (next: LaptopPage) => {
    void navigate(routeForPage(next));
  };
  if (kind === 'home')
    return <Frame>{viewport === 'mobile' ? <MobileHome channel="android" /> : viewport === 'tablet' ? <TabletHome /> : window.innerWidth >= 1400 ? <WideDesktopHome onSelectTab={select} /> : <DesktopHome onSelectTab={select} />}</Frame>;
  if (kind === 'catalog') return <Frame>{viewport === 'mobile' ? <MobileCatalog channel="android" /> : viewport === 'tablet' ? <TabletCatalog /> : <DesktopCatalog onSelectTab={select} />}</Frame>;
  if (kind === 'product') return <Frame>{viewport === 'mobile' ? <MobileProduct channel="android" /> : viewport === 'tablet' ? <TabletProduct /> : <DesktopProduct onSelectTab={select} />}</Frame>;
  if (kind === 'cart') return <Frame>{viewport === 'mobile' ? <MobileCart channel="android" /> : viewport === 'tablet' ? <TabletCart /> : <DesktopCheckout onSelectTab={select} />}</Frame>;
  if (kind === 'checkout')
    return (
      <Frame>
        <DesktopCheckout onSelectTab={select} />
      </Frame>
    );
  if (kind === 'orders')
    return (
      <Frame>
        {new URLSearchParams(location.search).get('view') === 'invoices' ? (
          <main className="sw-web-container mx-auto max-w-[1240px] space-y-3 p-3 sm:p-5">
            <button type="button" onClick={() => void navigate('/orders')} className="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-blue-700">
              返回订单列表
            </button>
            <Invoices />
          </main>
        ) : viewport === 'mobile' ? (
          <MobileAccount
            channel="android"
            onAfterSale={(id) => {
              if (id) void navigate(`/orders/${encodeURIComponent(id)}/aftersales`);
            }}
          />
        ) : viewport === 'tablet' ? (
          <TabletOrders onAfterSale={(id) => void navigate(`/orders/${encodeURIComponent(id)}/aftersales`)} />
        ) : (
          <DesktopOrders onSelectTab={select} onAfterSale={(id) => void navigate(`/orders/${encodeURIComponent(id)}/aftersales`)} />
        )}
      </Frame>
    );
  return (
    <Frame>
      <MobileAccount
        channel="android"
        onAfterSale={(id) => {
          if (id) void navigate(`/orders/${encodeURIComponent(id)}/aftersales`);
        }}
      />
    </Frame>
  );
}

function AfterSaleRoute() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  if (!orderId || !/^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(orderId)) return <Navigate replace to={ROUTES.orders} />;
  return (
    <Frame>
      <AfterSale orderId={orderId} onBack={() => void navigate(`/orders/${encodeURIComponent(orderId)}`)} />
    </Frame>
  );
}

function SupportCaseRoute() {
  const { caseId } = useParams();
  if (!caseId || !/^[A-Za-z0-9][A-Za-z0-9.:/-]{1,254}$/.test(caseId)) return <Navigate replace to={ROUTES.support} />;
  return (
    <Frame>
      <Conversation caseId={caseId} />
    </Frame>
  );
}
