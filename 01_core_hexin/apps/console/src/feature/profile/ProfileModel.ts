import { PERMISSION_CATALOG } from '@shop/authz';
import type { ConsoleContext, ConsoleScope } from '../../entity/session/ConsoleSession';
import {
  normalizeConsoleCopy,
  scopeDisplayName,
  scopeIdentifierLabel,
  scopeKindLabel,
} from '../../entity/session/ScopePresentation';
import type { AccessMembership, AccessRole } from '../access/AccessSchema';

type AssignedRole = Pick<AccessMembership['roles'][number], 'role' | 'name'>;
type RoleDefinition = Pick<AccessRole, 'id' | 'name' | 'governance'>;

export interface PermissionGroup {
  readonly category: string;
  readonly label: string;
  readonly permissions: readonly string[];
}

export interface PresentedRole {
  readonly id: string;
  readonly label: string;
}

export interface RolePartition {
  readonly governance: readonly PresentedRole[];
  readonly business: readonly PresentedRole[];
}

export interface ScopeTrailItem {
  readonly key: string;
  readonly kind: string;
  readonly name: string;
}

const categoryLabels = Object.freeze({
  runtime: '平台运行',
  identity: '身份与登录',
  organization: '组织治理',
  access: '管理与权限',
  capability: '功能授权',
  partner: '商户生态',
  member: '会员管理',
  qualification: '资质治理',
  channel: '渠道管理',
  catalog: '商品目录',
  pricing: '定价',
  inventory: '库存',
  marketing: '营销',
  referral: '分销返佣',
  reporting: '数据报表',
  experience: '商城与装修',
  cart: '购物车',
  checkout: '结算',
  order: '订单与售后',
  fulfillment: '履约',
  payment: '支付',
  verification: '核销',
  voucher: '卡券',
  benefit: '福利资产',
  finance: '财务',
  invoice: '发票',
  support: '客户服务',
  notification: '通知',
  risk: '风险',
  observability: '运行观测',
  audit: '审计',
  extension: '插件生态',
} satisfies Record<string, string>);

const permissionByCode = new Map(PERMISSION_CATALOG.map((permission) => [permission.code, permission]));
const categoryOrder = new Map(
  [...new Set(PERMISSION_CATALOG.map((permission) => permission.category))]
    .map((category, index) => [category, index] as const),
);

const canonicalGovernanceRoles = new Set([
  'role-platform-owner-v2',
  'role-platform-owner-successor-v1',
  'role-zhudatuan-pending-operator',
]);

export function permissionGroupsOf(permissions: readonly string[]): readonly PermissionGroup[] {
  const grouped = new Map<string, string[]>();
  for (const code of new Set(permissions)) {
    const category = permissionByCode.get(code)?.category ?? code.split('.')[0] ?? 'other';
    const values = grouped.get(category) ?? [];
    values.push(code);
    grouped.set(category, values);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => (categoryOrder.get(left) ?? Number.MAX_SAFE_INTEGER)
      - (categoryOrder.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right))
    .map(([category, values]) => Object.freeze({
      category,
      label: categoryLabels[category as keyof typeof categoryLabels] ?? normalizeConsoleCopy(category),
      permissions: Object.freeze([...values].sort((left, right) => left.localeCompare(right))),
    }));
}

export function partitionAssignedRoles(
  roles: readonly AssignedRole[],
  scopeKind: ConsoleScope['kind'],
  definitions: readonly RoleDefinition[] = [],
): RolePartition {
  const governance: PresentedRole[] = [];
  const business: PresentedRole[] = [];
  const definitionById = new Map(definitions.map((role) => [role.id, role] as const));
  for (const role of roles) {
    if (role.role === 'role:self') continue;
    const isGovernance = canonicalGovernanceRoles.has(role.role) || definitionById.get(role.role)?.governance === true;
    const presented = Object.freeze({ id: role.role, label: isGovernance
      ? governanceLabelFor(role, scopeKind)
      : normalizeConsoleCopy(role.name) });
    (isGovernance ? governance : business).push(presented);
  }
  return Object.freeze({ governance: Object.freeze(governance), business: Object.freeze(business) });
}

export function scopeTrailOf(context: ConsoleContext): readonly ScopeTrailItem[] {
  const nodes = [...(context.scope.path ?? []), { kind: context.scope.kind, id: context.scope.id }];
  const unique = new Map(nodes.map((node) => [`${node.kind}:${node.id}`, node] as const));
  return Object.freeze([...unique.values()].map((node) => Object.freeze({
    key: `${node.kind}:${node.id}`,
    kind: scopeKindLabel(node.kind),
    name: node.kind === context.scope.kind && node.id === context.scope.id
      ? scopeDisplayName(context.scope)
      : scopeIdentifierLabel(node.kind, node.id),
  })));
}

export function formatDateTime(value: string | null | undefined): string {
  if (value === null || value === undefined) return '未返回';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间格式异常';
  return date.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

export function profileStatusOf(status: string | undefined): Readonly<{
  label: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}> {
  if (status === undefined) return { label: '状态未返回', tone: 'neutral' };
  if (status === 'active') return { label: '资料正常', tone: 'success' };
  if (status === 'pending') return { label: '资料待完善', tone: 'warning' };
  if (status === 'suspended' || status === 'disabled') return { label: '资料已停用', tone: 'danger' };
  return { label: normalizeConsoleCopy(status), tone: 'neutral' };
}

function governanceLabelFor(role: AssignedRole, scopeKind: ConsoleScope['kind']): string {
  if (role.role === 'role-platform-owner-v2') return '平台 Owner';
  if (role.role === 'role-platform-owner-successor-v1') return 'Owner 受让候选人';
  if (role.role === 'role-zhudatuan-pending-operator') return '待授权管理员';
  const normalizedName = normalizeConsoleCopy(role.name).trim();
  if (normalizedName.toLocaleLowerCase() === 'owner') return scopeKind === 'platform' ? '平台 Owner' : '商户 Owner';
  return normalizedName;
}
