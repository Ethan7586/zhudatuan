import { createBrowserRouter, type RouteObject } from 'react-router';
import { RouteFallback } from '@shop/design';
import { RouteError } from './RouteError';
import { ScopeShell } from '../shell/ScopeShell';
import { landingLoader, scopeLoader } from './SessionLoader';
import { consoleModules } from './ConsoleModuleRegistry';
import { materializeConsoleIndexRoute, materializeConsoleModules } from './ConsoleModuleRoutes';

export const consoleScopeChildren = [
  materializeConsoleIndexRoute(consoleModules),
  ...materializeConsoleModules(consoleModules),
  { path: '*', lazy: () => import('./NotFoundRoute') },
] satisfies RouteObject[];

const previewBasename = import.meta.env.VITE_ROUTER_BASENAME?.trim() || undefined;

const previewBasename = import.meta.env.VITE_ROUTER_BASENAME?.trim() || undefined;

const previewBasename = import.meta.env.VITE_ROUTER_BASENAME?.trim() || undefined;

export const consoleRouter = createBrowserRouter([
  {
    path: '/',
    loader: landingLoader,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
  },
  {
    id: 'scope',
    path: '/scopes/:scopeKind/:scopeId',
    loader: scopeLoader,
    Component: ScopeShell,
    HydrateFallback: RouteFallback,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="cockpit" replace /> },
      { path: 'cockpit', lazy: () => import('../feature/cockpit/CockpitRoute') },
      { path: 'control', lazy: () => import('../feature/control/ControlRoute') },
      { path: 'products', lazy: () => import('../feature/product/ProductRoute') },
      { path: 'products/:productId', lazy: () => import('../feature/product/ProductDetailRoute') },
      { path: 'orders', lazy: () => import('../feature/order/OrderRoute') },
      { path: 'orders/:orderId', lazy: () => import('../feature/order/OrderDetailRoute') },
      { path: 'referral', element: <Navigate to="settings" replace /> },
      { path: 'referral/settings', lazy: () => import('../feature/referral/ReferralRoute') },
      { path: 'referral/products', lazy: () => import('../feature/referral/ReferralRoute') },
      { path: 'referral/review', lazy: () => import('../feature/referral/ReferralRoute') },
      { path: 'referral/bindings', lazy: () => import('../feature/referral/ReferralRoute') },
      { path: 'referral/withdrawals', lazy: () => import('../feature/referral/ReferralRoute') },
      { path: 'referral/promotion', lazy: () => import('../feature/referral/ReferralRoute') },
      { path: 'finance', lazy: () => import('../feature/finance/FinanceRoute') },
      { path: 'finance/entries', lazy: () => import('../feature/finance/EntryRoute') },
      { path: 'finance/statements', lazy: () => import('../feature/finance/StatementRoute') },
      { path: 'finance/reconciliations', lazy: () => import('../feature/finance/ReconciliationRoute') },
      { path: 'finance/settlements', lazy: () => import('../feature/finance/SettlementRoute') },
      { path: 'finance/withdrawals', lazy: () => import('../feature/finance/WithdrawalRoute') },
      { path: 'finance/invoices', lazy: () => import('../feature/finance/InvoiceRoute') },
      { path: 'applications', lazy: () => import('../feature/application/ApplicationRoute') },
      { path: 'vouchers', lazy: () => import('../feature/voucher/VoucherRoute') },
      { path: 'reports', lazy: () => import('../feature/report/ReportRoute') },
      { path: 'support/:caseId?', lazy: () => import('../feature/support/SupportRoute') },
      { path: 'settings/access', lazy: () => import('../feature/access/AccessRoute') },
      { path: 'settings/members', lazy: () => import('../feature/member/MemberRoute') },
      { path: 'settings/qualification', lazy: () => import('../feature/qualification/QualificationRoute') },
      { path: 'settings/notification', lazy: () => import('../feature/notification/NotificationRoute') },
      { path: 'channels', lazy: () => import('../feature/channel/ChannelRoute') },
      { path: 'imports/:kind/:jobId', lazy: () => import('../feature/importing/ImportRoute') },
      { path: '*', lazy: () => import('./NotFoundRoute') },
    ],
  },
  { path: '*', lazy: () => import('./NotFoundRoute') },
], previewBasename === undefined ? undefined : { basename: previewBasename });
