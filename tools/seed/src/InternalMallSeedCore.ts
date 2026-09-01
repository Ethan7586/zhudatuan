import type { Client } from 'pg';

import {
  INTERNAL_MALL_DATASET,
  INTERNAL_MALL_ENVIRONMENT,
  INTERNAL_MALL_REMARK,
  INTERNAL_MALL_SOURCE,
  INTERNAL_MALL_TIMEZONE,
  metadata,
  stableHash,
  type DatasetOptions,
  type InternalMallPlan,
  type MemberFixture,
} from './InternalMallFixtures';
import { insertRows, postFinance, stage } from './InternalMallDatabase';

export const PLATFORM_ID = 'organization-platform-root';
export const TENANT_ID = 'itht:tenant';
export const ENTERPRISE_ID = 'itht:enterprise';
export const MALL_ID = 'itht:mall';
export const APPLICATION_ID = 'itht:application';
export const PRICEBOOK_ID = 'itht:pricebook';
export const SUPPLIER_IDS = Object.freeze(Array.from({ length: 8 }, (_, index) => `itht:supplier:${String(index + 1).padStart(2, '0')}`));
export const STORE_IDS = Object.freeze(Array.from({ length: 6 }, (_, index) => `itht:store:${String(index + 1).padStart(2, '0')}`));
export const POOL_IDS = Object.freeze(Array.from({ length: 4 }, (_, index) => `itht:pool:${String(index + 1).padStart(2, '0')}`));
export const CAMPAIGN_IDS = Object.freeze(Array.from({ length: 12 }, (_, index) => `itht:campaign:${String(index + 1).padStart(2, '0')}`));
export const VOUCHER_PROGRAM_IDS = Object.freeze(Array.from({ length: 8 }, (_, index) => `itht:voucher-program:${String(index + 1).padStart(2, '0')}`));
export const VOUCHER_VALUES = Object.freeze([500, 800, 1_000, 1_200, 1_400, 1_600, 1_800, 2_000]);
export const MEMBER_GRANT_MINOR = 3_000_000;

export interface BenefitFixture {
  readonly accountId: string;
  readonly financeAccountId: string;
  readonly lotId: string;
  readonly member: MemberFixture;
}

export interface VoucherFixture {
  readonly batchId: string;
  readonly cardId: string;
  readonly id: string;
  readonly index: number;
  readonly initialMinor: number;
  readonly memberId: string | null;
  readonly programId: string;
}

export interface CoreSeedState {
  readonly benefits: ReadonlyMap<string, BenefitFixture>;
  readonly vouchers: readonly VoucherFixture[];
}

export async function seedCore(
  database: Client,
  options: DatasetOptions,
  plan: InternalMallPlan,
): Promise<CoreSeedState> {
  await seedOrganizations(database);
  await seedPartners(database);
  const benefits = await seedMembers(database, plan.members);
  await seedCatalog(database, plan);
  const vouchers = await seedVouchers(database, plan.members);
  await seedCampaigns(database);
  stage('core_complete', {
    campaigns: CAMPAIGN_IDS.length,
    members: plan.members.length,
    orders_target: options.ordersTarget,
    products: plan.products.length,
    skus: plan.skus.length,
    vouchers: vouchers.length,
  });
  return Object.freeze({ benefits, vouchers });
}

async function seedOrganizations(database: Client): Promise<void> {
  const created = '2026-08-16T00:00:00+08:00';
  const organizations = [
    [TENANT_ID, 'tenant', PLATFORM_ID, '[内测] 宏泰租户'],
    [ENTERPRISE_ID, 'enterprise', TENANT_ID, '[内测] 宏泰集团'],
    [MALL_ID, 'mall', ENTERPRISE_ID, '[内测] 宏泰甄选'],
    ...Array.from({ length: 8 }, (_, index) => [
      `itht:group:${String(index + 1).padStart(2, '0')}`,
      'department',
      ENTERPRISE_ID,
      `[内测] 会员分组${String(index + 1).padStart(2, '0')}`,
    ]),
  ] as const;
  await insertRows(database, 'organization.organization', ['id', 'kind', 'parent_id', 'name', 'timezone', 'status', 'version', 'created_at', 'updated_at'],
    organizations.map(([id, kind, parent, name]) => [id, kind, parent, name, INTERNAL_MALL_TIMEZONE, 'active', 0, created, created]));
  const parents = new Map(organizations.map(([id, , parent]) => [id, parent]));
  const closure: unknown[][] = [];
  for (const [id] of organizations) {
    closure.push([id, id, 0]);
    let parent = parents.get(id);
    let depth = 1;
    while (parent) {
      closure.push([parent, id, depth]);
      parent = parents.get(parent);
      depth += 1;
    }
  }
  await insertRows(database, 'organization.unitclosure', ['ancestor_id', 'descendant_id', 'depth'], closure, 'on conflict do nothing');
  await insertRows(database, 'organization.assignment', ['parent_id', 'child_id', 'kind', 'status', 'evidence', 'effective_at', 'expires_at', 'created_at', 'updated_at'],
    organizations.map(([id, , parent]) => [parent, id, 'administrative', 'active', metadata(), created, null, created, created]));
  await insertRows(database, 'experience.application', ['id', 'scope_id', 'code', 'public_slug', 'name', 'status', 'head_version_id', 'created_at', 'updated_at', 'version'], [[
    APPLICATION_ID, MALL_ID, 'INTERNAL_HONGTAI', 'internal-hongtai', '[内测] 宏泰甄选', 'active', null, created, created, 0,
  ]]);
  const ledger = await database.query<{ readonly id: string; readonly legal_timezone: string }>(`
    insert into finance.ledger(id,scope_id,code,name,currency,legal_timezone,state,version)
    values(finance.ledger_id($1,'CNY'),$1,'general','General ledger','CNY',$2,'active',0)
    on conflict(scope_id,code,currency) do update set state='active'
    returning id,legal_timezone`, [MALL_ID, INTERNAL_MALL_TIMEZONE]);
  await insertRows(database, 'finance.period', [
    'scope_id', 'period', 'state', 'closed_at', 'closed_by', 'ledger_id', 'legal_timezone', 'period_start_at', 'period_end_at',
  ], [[
    MALL_ID, '2026-08', 'open', null, null, ledger.rows[0]!.id, ledger.rows[0]!.legal_timezone,
    '2026-08-01T00:00:00+08:00', '2026-09-01T00:00:00+08:00',
  ]]);
  stage('organizations', { enterprise: 1, groups: 8, mall: 1, tenant: 1 });
}

async function seedPartners(database: Client): Promise<void> {
  const created = '2026-08-16T01:00:00+08:00';
  const supplierNames = [
    '[内测] 自营供应商A', '[内测] 自营供应商B', '[内测] 实物供应商A', '[内测] 实物供应商B',
    '[内测] 实物供应商C', '[内测] 虚拟权益供应商', '[内测] 门店服务供应商A', '[内测] 门店服务供应商B',
  ];
  await insertRows(database, 'partner.partner', ['id', 'scope_id', 'kind', 'name', 'status', 'version', 'created_at', 'updated_at'], [
    ...SUPPLIER_IDS.map((id, index) => [id, MALL_ID, 'supplier', supplierNames[index], 'active', 0, created, created]),
    ...STORE_IDS.map((id, index) => [id, MALL_ID, 'store', `[内测] 上海门店${String(index + 1).padStart(2, '0')}`, 'active', 0, created, created]),
  ]);
  await insertRows(database, 'partner.store', ['id', 'mall_id', 'region_code', 'address_ciphertext', 'address_token', 'address_key_version', 'service_radius_meters'],
    STORE_IDS.map((id, index) => [id, MALL_ID, `3101${String(index).padStart(2, '0')}`, null, null, null, 3_000 + index * 500]));
  await insertRows(database, 'partner.servicebinding', ['store_id', 'organization_id', 'service', 'status', 'effective_at', 'expires_at'],
    STORE_IDS.flatMap((id) => ['verification', 'service', 'fulfillment'].map((service) => [id, MALL_ID, service, 'active', created, null])));
  stage('partners', { stores: STORE_IDS.length, suppliers: SUPPLIER_IDS.length });
}

async function seedMembers(
  database: Client,
  members: readonly MemberFixture[],
): Promise<ReadonlyMap<string, BenefitFixture>> {
  const created = '2026-08-16T02:00:00+08:00';
  await insertRows(database, 'identity.principal', ['id', 'status', 'credential_version', 'created_at', 'updated_at', 'version'],
    members.map((member) => [member.principalId, member.principalStatus, 1, created, created, 0]));
  await insertRows(database, 'member.profile', ['id', 'principal_id', 'display_name', 'status', 'created_at', 'updated_at', 'version'],
    members.map((member) => [member.id, member.principalId, member.name, member.profileStatus, created, created, 0]));
  await insertRows(database, 'access.membership', ['id', 'member_id', 'organization_id', 'client', 'employee_no', 'status', 'access_version', 'joined_at', 'left_at'],
    members.map((member) => [member.membershipId, member.id, MALL_ID, 'storefront',
      `ITHT-G${String(member.group).padStart(2, '0')}-${String(member.index).padStart(3, '0')}`, member.membershipStatus, 1, created, null]));
  await insertRows(database, 'access.membershiprole', ['membership_id', 'role_id', 'effective_at', 'expires_at', 'delegated_by'],
    members.map((member) => [member.membershipId, 'role:self', created, null, null]));
  await insertRows(database, 'access.scopegrant', ['id', 'membership_id', 'scope_kind', 'scope_id', 'scope_path', 'effect', 'effective_at', 'expires_at', 'access_version'],
    members.flatMap((member) => [[
      `itht:scopegrant:${String(member.index).padStart(3, '0')}:self`, member.membershipId, 'self', `self:${member.principalId}`, `self:${member.principalId}`, 'allow', created, null, 1,
    ], [
      `itht:scopegrant:${String(member.index).padStart(3, '0')}:owner`, member.membershipId, 'owner', member.id, member.id, 'allow', created, null, 1,
    ]]));

  const active = members.filter((member) => member.index <= 210);
  const planId = 'itht:benefit-plan';
  const budgetId = 'itht:benefit-budget';
  const batchId = 'itht:benefit-batch';
  await insertRows(database, 'benefit.plan', ['id', 'scope_id', 'name', 'kind', 'currency', 'state', 'version'], [[
    planId, MALL_ID, '[内测] 宏泰福利积分', 'welfare', 'CNY', 'active', 1,
  ]]);
  await insertRows(database, 'benefit.planversion', ['plan_id', 'version', 'name', 'kind', 'currency', 'state', 'changed_by', 'changed_at'], [[
    planId, 1, '[内测] 宏泰福利积分', 'welfare', 'CNY', 'active', members[0]!.principalId, created,
  ]]);
  const grantTotal = active.length * MEMBER_GRANT_MINOR;
  await insertRows(database, 'benefit.budget', ['id', 'plan_id', 'period', 'total_minor', 'granted_minor', 'reserved_minor', 'version'], [[
    budgetId, planId, '2026-08', grantTotal, grantTotal, 0, 0,
  ]]);
  await insertRows(database, 'benefit.grantbatch', ['id', 'plan_id', 'budget_id', 'state', 'requested_by', 'approved_by', 'requested_count', 'amount_minor', 'reason', 'created_at', 'updated_at', 'plan_version', 'effective_at', 'expires_at', 'timezone', 'snapshot_hash', 'pause_reason'], [[
    batchId, planId, budgetId, 'completed', members[0]!.principalId, 'itht:system:approver', active.length, MEMBER_GRANT_MINOR,
    INTERNAL_MALL_REMARK, created, created, 1, created, '2027-08-31T23:59:59+08:00', INTERNAL_MALL_TIMEZONE, stableHash('benefit-batch'), null,
  ]]);
  await insertRows(database, 'benefit.grantitem', ['batch_id', 'member_id', 'amount_minor', 'state', 'error_code'],
    active.map((member) => [batchId, member.id, MEMBER_GRANT_MINOR, 'granted', null]));

  const benefits = new Map<string, BenefitFixture>();
  const accountRows: unknown[][] = [];
  const lotRows: unknown[][] = [];
  const movementRows: unknown[][] = [];
  for (const member of active) {
    const accountId = `itht:benefit-account:${String(member.index).padStart(3, '0')}`;
    const lotId = `itht:benefit-lot:${String(member.index).padStart(3, '0')}`;
    const code = `benefit.itht.${String(member.index).padStart(3, '0')}`;
    let financeAccount;
    try {
      financeAccount = await database.query<{ readonly id: string }>('select finance.ensure_account($1,$2,$3,$4) id', [MALL_ID, code, 'CNY', 'liability']);
    } catch (cause) {
      const error = cause as Error & { readonly code?: string };
      throw Object.assign(new Error(`INTERNAL_DATASET_FINANCE_ACCOUNT_FAILED:${error.message}`, { cause }), { code: error.code });
    }
    const financeAccountId = financeAccount.rows[0]!.id;
    accountRows.push([accountId, member.id, MALL_ID, 'welfare', 'CNY', 'active', 0, financeAccountId]);
    lotRows.push([lotId, accountId, batchId, member.id, MEMBER_GRANT_MINOR, MEMBER_GRANT_MINOR, 'active', created, '2027-08-31T23:59:59+08:00', 'grant', 0]);
    movementRows.push([`itht:benefit-movement:grant:${String(member.index).padStart(3, '0')}`, lotId, 'grant', MEMBER_GRANT_MINOR, 'grantbatch', batchId, null, created]);
    benefits.set(member.id, Object.freeze({ accountId, financeAccountId, lotId, member }));
  }
  await insertRows(database, 'benefit.account', ['id', 'member_id', 'scope_id', 'kind', 'currency', 'status', 'version', 'finance_account_id'], accountRows);
  await insertRows(database, 'benefit.lot', ['id', 'account_id', 'batch_id', 'member_id', 'total_minor', 'remaining_minor', 'state', 'effective_at', 'expires_at', 'origin', 'version'], lotRows);
  await insertRows(database, 'benefit.lotmovement', ['id', 'lot_id', 'kind', 'amount_minor', 'reference_type', 'reference_id', 'source_id', 'occurred_at'], movementRows);
  for (const benefit of benefits.values()) await postFinance(database, {
    amountMinor: MEMBER_GRANT_MINOR,
    creditCode: `benefit.itht.${String(benefit.member.index).padStart(3, '0')}`,
    creditKind: 'liability',
    debitCode: 'benefit.expense',
    debitKind: 'expense',
    description: INTERNAL_MALL_REMARK,
    occurredAt: created,
    referenceId: benefit.member.id,
    referenceType: 'benefit.grant',
    scope: MALL_ID,
  });
  stage('members', { accounts: benefits.size, active: 210, disabled: 10, incomplete: 10, memberships: members.length, pending: 10 });
  return benefits;
}

async function seedCatalog(database: Client, plan: InternalMallPlan): Promise<void> {
  const created = '2026-08-16T03:00:00+08:00';
  const updated = '2026-08-31T22:30:00+08:00';
  await insertRows(database, 'catalog.category', ['id', 'parent_id', 'code', 'name', 'status', 'sort_order'],
    Array.from({ length: 12 }, (_, index) => [`itht:category:${String(index + 1).padStart(2, '0')}`, null,
      `ITHT-CATEGORY-${String(index + 1).padStart(2, '0')}`, `[内测] 商品分类${String(index + 1).padStart(2, '0')}`, 'active', index + 1]));
  await insertRows(database, 'catalog.product', ['id', 'owner_partner_id', 'brand_id', 'category_id', 'title', 'product_type', 'attributes', 'status', 'version', 'created_at', 'updated_at'],
    plan.products.map((product) => [product.id, product.supplierId, null, product.categoryId, product.name, product.kind, metadata({
      subtitle: `[内测] ${INTERNAL_MALL_REMARK}`,
      supplier_id: product.supplierId,
    }), 'active', 0, created, updated]));
  await insertRows(database, 'catalog.sku', ['id', 'product_id', 'code', 'specifications', 'status', 'version'],
    plan.skus.map((sku) => [sku.id, sku.product.id, sku.code, metadata({
      purchase_minor: sku.purchaseMinor,
      settlement_minor: sku.settlementMinor,
      variant: sku.variant,
    }), 'active', 0]));
  await insertRows(database, 'catalog.pool', ['id', 'scope_id', 'kind', 'name', 'status', 'version'],
    POOL_IDS.map((id, index) => [id, MALL_ID, index === 0 ? 'private' : index === 1 ? 'channel' : index === 2 ? 'markup' : 'global',
      `[内测] 商品池${String(index + 1).padStart(2, '0')}`, 'active', 0]));
  await insertRows(database, 'catalog.poolitem', ['pool_id', 'sku_id', 'state', 'source_version', 'added_at'],
    plan.skus.map((sku) => [POOL_IDS[(sku.product.index - 1) % POOL_IDS.length], sku.id, 'included', INTERNAL_MALL_DATASET, created]));
  await insertRows(database, 'catalog.poolbinding', ['mall_id', 'pool_id', 'listing_kind', 'status', 'effective_at', 'expires_at', 'created_at'],
    POOL_IDS.map((pool) => [MALL_ID, pool, 'combined', 'active', created, null, created]));
  await insertRows(database, 'catalog.listing', ['id', 'scope_id', 'pool_id', 'sku_id', 'title', 'status', 'effective_at', 'expires_at', 'version', 'created_at', 'updated_at'],
    plan.listings.map((listing) => [listing.id, MALL_ID, POOL_IDS[(listing.product.index - 1) % POOL_IDS.length], listing.sku.id,
      listing.product.name, listing.state, listing.state === 'published' ? created : null, null, 0, created, updated]));
  await insertRows(database, 'pricing.pricebook', ['id', 'scope_id', 'currency', 'name', 'status', 'version'], [[
    PRICEBOOK_ID, MALL_ID, 'CNY', '[内测] 宏泰甄选价格本', 'active', 0,
  ]]);
  await insertRows(database, 'pricing.price', ['id', 'book_id', 'sku_id', 'amount_minor', 'compare_minor', 'effective_at', 'expires_at'],
    plan.skus.map((sku, index) => [`itht:price:${String(index + 1).padStart(4, '0')}`, PRICEBOOK_ID, sku.id, sku.priceMinor,
      Math.floor(sku.priceMinor * 1.2), created, null]));
  await insertRows(database, 'inventory.stockitem', ['id', 'scope_id', 'sku_id', 'location_id', 'onhand', 'safety', 'version', 'status', 'updated_at'],
    plan.skus.map((sku, index) => [`itht:stock:${String(index + 1).padStart(4, '0')}`, MALL_ID, sku.id, sku.product.supplierId,
      sku.initialStock, sku.safety, 0, 'active', created]));
  await insertRows(database, 'inventory.snapshot', ['stockitem_id', 'observed_at', 'source', 'onhand', 'source_version'],
    plan.skus.map((sku, index) => [`itht:stock:${String(index + 1).padStart(4, '0')}`, created, INTERNAL_MALL_SOURCE, sku.initialStock, INTERNAL_MALL_DATASET]));
  await insertRows(database, 'inventory.movement', ['id', 'stockitem_id', 'kind', 'quantity_delta', 'reference_type', 'reference_id', 'occurred_at'],
    plan.skus.flatMap((sku, index) => sku.initialStock === 0 ? [] : [[`itht:inventory:receive:${String(index + 1).padStart(4, '0')}`,
      `itht:stock:${String(index + 1).padStart(4, '0')}`, 'receive', sku.initialStock, 'dataset', INTERNAL_MALL_DATASET, created]]));
  await insertRows(database, 'experience.binding', ['application_id', 'domain', 'mall_id', 'pool_id'], [[
    APPLICATION_ID, 'internal-hongtai.local', MALL_ID, POOL_IDS[0],
  ]]);
  stage('catalog', {
    categories: 12,
    draft_listings: plan.listings.filter(({ state }) => state === 'draft').length,
    listings: plan.listings.length,
    low_stock: plan.skus.filter(({ isLowStock }) => isLowStock).length,
    pools: POOL_IDS.length,
    products: plan.products.length,
    published_listings: plan.listings.filter(({ state }) => state === 'published').length,
    skus: plan.skus.length,
    sold_out: plan.skus.filter(({ isSoldOut }) => isSoldOut).length,
    unpublished_listings: plan.listings.filter(({ state }) => state === 'unpublished').length,
  });
}

async function seedVouchers(database: Client, members: readonly MemberFixture[]): Promise<readonly VoucherFixture[]> {
  const created = '2026-08-16T04:00:00+08:00';
  await insertRows(database, 'voucher.program', ['id', 'scope_id', 'name', 'value_minor', 'default_valid_days', 'currency', 'status', 'approval_required', 'version'],
    VOUCHER_PROGRAM_IDS.map((id, index) => [id, MALL_ID, `[内测] 积分卡项目${String(index + 1).padStart(2, '0')}`,
      VOUCHER_VALUES[index], 365, 'CNY', 'active', false, 1]));
  await insertRows(database, 'voucher.programversion', ['program_id', 'version', 'value_minor', 'default_valid_days', 'approval_required', 'status', 'changed_by', 'changed_at'],
    VOUCHER_PROGRAM_IDS.map((id, index) => [id, 1, VOUCHER_VALUES[index], 365, false, 'active', 'itht:system:seed', created]));
  await insertRows(database, 'voucher.cardpool', ['id', 'scope_id', 'code_prefix', 'next_sequence', 'provider', 'status', 'version', 'mode'],
    VOUCHER_PROGRAM_IDS.map((_, index) => [`itht:cardpool:${String(index + 1).padStart(2, '0')}`, MALL_ID,
      `MOCK-VOUCHER-ITHT-${String(index + 1).padStart(2, '0')}`, 31, 'mock-voucher', 'ready', 0, 'generated']));
  const batches = Array.from({ length: 16 }, (_, index) => {
    const program = index % 8;
    return {
      id: `itht:issuebatch:${String(index + 1).padStart(2, '0')}`,
      poolId: `itht:cardpool:${String(program + 1).padStart(2, '0')}`,
      programId: VOUCHER_PROGRAM_IDS[program]!,
    };
  });
  await insertRows(database, 'voucher.issuebatch', ['id', 'program_id', 'cardpool_id', 'state', 'requested_count', 'issued_count', 'created_at', 'reserve_request_id', 'program_version'],
    batches.map((batch) => [batch.id, batch.programId, batch.poolId, 'completed', 15, 15, created, null, 1]));
  await insertRows(database, 'voucher.allocation', ['id', 'cardpool_id', 'scope_id', 'quantity', 'used_count', 'version', 'created_at', 'updated_at'],
    VOUCHER_PROGRAM_IDS.map((_, index) => [`itht:allocation:${String(index + 1).padStart(2, '0')}`,
      `itht:cardpool:${String(index + 1).padStart(2, '0')}`, MALL_ID, 30, 30, 0, created, created]));

  const vouchers: VoucherFixture[] = [];
  const cardRows: unknown[][] = [];
  const voucherRows: unknown[][] = [];
  const statusRows: unknown[][] = [];
  for (let zeroBased = 0; zeroBased < 240; zeroBased += 1) {
    const index = zeroBased + 1;
    const programIndex = zeroBased % 8;
    const batch = batches[zeroBased % batches.length]!;
    const cardId = `itht:card:${String(index).padStart(3, '0')}`;
    const voucherId = `itht:voucher:${String(index).padStart(3, '0')}`;
    const memberId = index <= 220 ? members[zeroBased % 210]!.id : null;
    const currentState = index <= 180 ? 'bound' : index <= 190 ? 'expired' : index <= 200 ? 'disabled' : 'created';
    const code = `MOCK-VOUCHER-${stableHash('voucher-code', index).slice(0, 24).toUpperCase()}`;
    const fingerprint = stableHash('voucher-fingerprint', index);
    cardRows.push([cardId, batch.poolId, `mockcipher:${code}`, fingerprint, 'mock-v1', 'allocated', batch.id, 0]);
    voucherRows.push([voucherId, VOUCHER_PROGRAM_IDS[programIndex], batch.id, memberId, `mockcipher:${code}`, fingerprint, 'mock-v1',
      VOUCHER_VALUES[programIndex], VOUCHER_VALUES[programIndex], currentState, '2027-08-31T23:59:59+08:00', 0, cardId, 1]);
    statusRows.push([voucherId, 1, null, 'created', 'datasetcreated', 'itht:system:seed', created]);
    if (index <= 220) statusRows.push([voucherId, 2, 'created', 'bound', 'datasetbound', 'itht:system:seed', created]);
    if (index <= 200) statusRows.push([voucherId, 3, index <= 220 ? 'bound' : 'created', currentState, 'datasetactivated', 'itht:system:seed', created]);
    vouchers.push(Object.freeze({ batchId: batch.id, cardId, id: voucherId, index, initialMinor: VOUCHER_VALUES[programIndex]!, memberId,
      programId: VOUCHER_PROGRAM_IDS[programIndex]! }));
  }
  await insertRows(database, 'voucher.card', ['id', 'cardpool_id', 'code_ciphertext', 'code_fingerprint', 'code_key_version', 'state', 'allocated_batch_id', 'version'], cardRows);
  await insertRows(database, 'voucher.voucher', ['id', 'program_id', 'batch_id', 'member_id', 'code_ciphertext', 'code_fingerprint', 'code_key_version',
    'initial_minor', 'remaining_minor', 'state', 'expires_at', 'version', 'card_id', 'program_version'], voucherRows);
  await insertRows(database, 'voucher.statusevent', ['voucher_id', 'sequence', 'previous_state', 'next_state', 'reason', 'actor_id', 'occurred_at'], statusRows);
  for (let index = 0; index < VOUCHER_PROGRAM_IDS.length; index += 1) await postFinance(database, {
    amountMinor: VOUCHER_VALUES[index]! * 25,
    creditCode: `voucher.program.${VOUCHER_PROGRAM_IDS[index]}`,
    creditKind: 'liability',
    debitCode: 'voucher.issue',
    debitKind: 'expense',
    description: INTERNAL_MALL_REMARK,
    occurredAt: created,
    referenceId: VOUCHER_PROGRAM_IDS[index]!,
    referenceType: 'voucher.issue',
    scope: MALL_ID,
  });
  stage('vouchers', { activated: 200, batches: 16, bound: 220, cards: 240, programs: 8, unactivated: 40 });
  return Object.freeze(vouchers);
}

async function seedCampaigns(database: Client): Promise<void> {
  const created = '2026-08-16T05:00:00+08:00';
  await insertRows(database, 'marketing.campaign', ['id', 'scope_id', 'kind', 'name', 'state', 'budget_minor', 'spent_minor', 'currency', 'rule', 'effective_at', 'expires_at', 'version', 'created_at', 'updated_at'],
    CAMPAIGN_IDS.map((id, index) => {
      const display = index < 3 ? 'active' : index < 6 ? 'disabled' : index < 9 ? 'expired' : 'sold_out';
      const state = index < 3 ? 'active' : index < 6 ? 'paused' : 'completed';
      return [id, MALL_ID, 'coupon', `[内测] 优惠活动${String(index + 1).padStart(2, '0')}`, state, 10_000_000, 0, 'CNY',
        metadata({ display_status: display, issued_target: 1_000 }), '2026-08-01T00:00:00+08:00',
        index >= 6 && index < 9 ? '2026-08-16T23:59:59+08:00' : '2026-12-31T23:59:59+08:00', 0, created, created];
    }));
  stage('campaigns', { active: 3, disabled: 3, expired: 3, sold_out: 3, total: 12 });
}

export function coreMetadata(extra: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return metadata({ dataset_id: INTERNAL_MALL_DATASET, environment: INTERNAL_MALL_ENVIRONMENT, source: INTERNAL_MALL_SOURCE, ...extra });
}
