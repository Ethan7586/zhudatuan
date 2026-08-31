import type { OperationId } from '@shop/contract';
import type {
  ConsoleModuleId,
  ConsoleModuleManifest,
  ConsoleModuleRoute,
} from '../entity/navigation/ConsoleModuleManifest';
import type { IconName } from '../shared/ui/Icon';
import { consoleModuleById } from './ConsoleModuleRegistry';

export interface ProfessionalRoute {
  readonly featureKey: string;
  readonly suffix: string;
  readonly pattern: RegExp;
  readonly title: string;
  readonly summary: string;
  readonly section: '业务运营' | '财务运营' | '组织设置';
  readonly icon: IconName;
  readonly operation: OperationId | null;
  readonly operations: readonly OperationId[];
  readonly blocker?: string;
}

export const professionalRoutes: readonly ProfessionalRoute[] = Object.freeze([
  projectRoute('applications', 'applications', 'applications.index', /^applications$/, '业务运营', 'application',
    'experience.applications.read'),
  projectRoute('vouchers', 'vouchers', 'vouchers.index', /^vouchers$/, '业务运营', 'voucher', 'voucher.programs.read'),
  projectRoute('reports', 'reports', 'reports.index', /^reports$/, '业务运营', 'report', 'reporting.sales.read'),
  projectRoute('support', 'support', 'support.index', /^support(?:\/[^/]+)?$/, '业务运营', 'support', 'support.cases.read', 'support'),
  projectRoute('referralhome', 'referral', 'referral.root', /^referral$/, '业务运营', 'channel', 'referral.settings.read'),
  projectRoute('referralsettings', 'referral', 'referral.settings', /^referral\/settings$/, '业务运营', 'channel',
    'referral.settings.read'),
  projectRoute('referralproducts', 'referral', 'referral.products', /^referral\/products$/, '业务运营', 'channel',
    'referral.products.read'),
  projectRoute('referralreview', 'referral', 'referral.review', /^referral\/review$/, '业务运营', 'channel',
    'referral.members.read'),
  projectRoute('referralbindings', 'referral', 'referral.bindings', /^referral\/bindings$/, '业务运营', 'channel',
    'referral.bindings.read'),
  projectRoute('referralwithdrawals', 'referral', 'referral.withdrawals', /^referral\/withdrawals$/, '财务运营', 'finance',
    'referral.commissions.read'),
  projectRoute('referralpromotion', 'referral', 'referral.promotion', /^referral\/promotion$/, '业务运营', 'channel',
    'referral.commissions.read'),
  projectRoute('channels', 'channels', 'channels.index', /^channels$/, '业务运营', 'channel', 'channel.connections.read'),
  projectImports(),
  projectRoute('entries', 'finance', 'finance.entries', /^finance\/entries$/, '财务运营', 'finance', 'finance.entries.read'),
  projectRoute('statements', 'finance', 'finance.statements', /^finance\/statements$/, '财务运营', 'finance',
    'finance.statements.read'),
  projectRoute('reconciliations', 'finance', 'finance.reconciliations', /^finance\/reconciliations$/, '财务运营', 'finance',
    'finance.reconciliations.read'),
  projectRoute('settlements', 'finance', 'finance.settlements', /^finance\/settlements$/, '财务运营', 'finance',
    'finance.settlements.read'),
  projectRoute('withdrawals', 'finance', 'finance.withdrawals', /^finance\/withdrawals$/, '财务运营', 'finance',
    'finance.withdrawals.read'),
  projectRoute('invoices', 'finance', 'finance.invoices', /^finance\/invoices$/, '财务运营', 'finance', 'invoice.requests.read'),
  projectRoute('access', 'access', 'access.index', /^settings\/access$/, '组织设置', 'access', 'access.center.read'),
  projectRoute('members', 'access', 'access.members', /^settings\/members$/, '组织设置', 'member', 'member.members.read'),
  projectRoute('qualification', 'qualification', 'qualification.index', /^settings\/qualification$/, '组织设置',
    'qualification', 'qualification.center.read'),
  projectRoute('notification', 'qualification', 'qualification.notification', /^settings\/notification$/, '组织设置',
    'notification', 'notification.templates.read'),
  projectRoute('productdetail', 'products', 'products.detail', /^products\/[^/]+$/, '业务运营', 'product', null),
  projectRoute('orderdetail', 'orders', 'orders.detail', /^orders\/[^/]+$/, '业务运营', 'orders', 'order.orders.read'),
]);

export function professionalRouteFromPath(pathname: string): ProfessionalRoute | undefined {
  const suffix = scopeSuffix(pathname);
  return professionalRoutes.find(({ pattern }) => pattern.test(suffix));
}

export function scopeSuffix(pathname: string): string {
  return pathname.split('/').filter(Boolean).slice(3).join('/');
}

function registryRoute<TModuleId extends ConsoleModuleId>(
  moduleId: TModuleId,
  routeId: `${TModuleId}.${string}`,
): ConsoleModuleRoute<TModuleId> {
  const module = consoleModuleById.get(moduleId) as ConsoleModuleManifest<TModuleId>;
  return module.routes.find(({ id }) => id === routeId)!;
}

function projectRoute<TModuleId extends ConsoleModuleId>(
  featureKey: string,
  moduleId: TModuleId,
  routeId: `${TModuleId}.${string}`,
  pattern: RegExp,
  section: ProfessionalRoute['section'],
  icon: IconName,
  operation: OperationId | null,
  legacySuffix?: string,
): ProfessionalRoute {
  const route = registryRoute(moduleId, routeId);
  return Object.freeze({
    featureKey,
    suffix: legacySuffix ?? route.path,
    pattern,
    title: route.presentation.title,
    summary: route.presentation.summary,
    section,
    icon,
    operation,
    operations: Object.freeze([...route.operations]),
    ...('blocker' in route && route.blocker !== undefined ? { blocker: route.blocker } : {}),
  });
}

function projectImports(): ProfessionalRoute {
  const member = registryRoute('access', 'access.member-import');
  const catalog = registryRoute('products', 'products.catalog-import');
  const voucher = registryRoute('vouchers', 'vouchers.import');
  return Object.freeze({
    featureKey: 'imports',
    suffix: 'imports/member/:jobId',
    pattern: /^imports\/(?:member|catalog|voucher)\/[^/]+$/,
    title: member.presentation.title,
    summary: member.presentation.summary,
    section: '业务运营',
    icon: 'import',
    operation: null,
    operations: Object.freeze([...member.operations, ...catalog.operations, ...voucher.operations]),
  });
}
