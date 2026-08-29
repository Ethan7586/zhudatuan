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
  route('vouchers', 'vouchers', /^vouchers$/, '卡券治理台', '按当前网站范围管理卡券方案、卡号库、备券申请与发行批次', '业务运营', 'voucher',
    'voucher.programs.read', ['voucher.cardlibraries.read', 'voucher.programs.read', 'voucher.reserves.read', 'voucher.batches.read']),
  route('reports', 'reports', /^reports$/, '数据报表', '商品、商城、分类、渠道和卡券投影', '业务运营', 'report',
    'reporting.sales.read', ['reporting.sales.read', 'reporting.products.read', 'reporting.malls.read', 'reporting.categories.read',
      'reporting.channels.read', 'reporting.powderclass.read', 'reporting.voucherconsumption.read']),
  route('support', 'support', /^support(?:\/[^/]+)?$/, '客服中心', '工单、对话、分派和 SLA 状态', '业务运营', 'support',
    'support.cases.read', ['support.cases.read', 'support.messages.read']),
  route('referralsettings', 'referral/settings', /^referral\/settings$/, '分销设定', '招募、绑定、结算和提现策略', '业务运营', 'channel', null),
  route('referralproducts', 'referral/products', /^referral\/products$/, '分销商品', '导购商品与返佣比例', '业务运营', 'channel', null),
  route('referralreview', 'referral/review', /^referral\/review$/, '分销审核', '会员申请与运营审核', '业务运营', 'channel', null),
  route('referralbindings', 'referral/bindings', /^referral\/bindings$/, '分销关系', '客户与导购的一层绑定关系', '业务运营', 'channel', null),
  route('referralwithdrawals', 'referral/withdrawals', /^referral\/withdrawals$/, '佣金提现', '已结算佣金与可提现余额', '财务运营', 'finance', null),
  route('referralpromotion', 'referral/promotion', /^referral\/promotion$/, '推广详情', '订单行返佣、奖励与冲正终态', '业务运营', 'channel', null),
  route('channels', 'channels', /^channels$/, '渠道管理', '连接、同步批次和外部操作回执', '业务运营', 'channel',
    'channel.connections.read', ['channel.connections.read', 'channel.syncruns.read', 'channel.operations.read']),
  route('imports', 'imports/member/:jobId', /^imports\/(?:member|catalog|voucher)\/[^/]+$/, '导入结果',
    '导入进度、错误行和服务端报告', '业务运营', 'import', null,
    ['member.imports.read', 'catalog.imports.read', 'voucher.imports.read']),
  route('entries', 'finance/entries', /^finance\/entries$/, '财务分录', '不可变借贷分录和业务引用', '财务运营', 'finance', 'finance.entries.read'),
  route('statements', 'finance/statements', /^finance\/statements$/, '账单', '服务端生成的期间账单', '财务运营', 'finance',
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
