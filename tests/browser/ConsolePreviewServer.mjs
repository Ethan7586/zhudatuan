import { createServer } from 'node:http';
import { OperationCatalog } from '@shop/contract';

import { applicationPreviewPage } from './ApplicationPreviewFixtures.ts';
import { cockpit, consoleSession, controlHealth } from './Fixtures.ts';
import { financeAuditPreviewPage, financePolicyPreviewPage, financePreviewEntriesPage, financePreviewOverview, financePreviewSettlementsPage, financeReconciliationPreviewPage, FinancePreviewQueryError } from './FinancePreviewFixtures.ts';
import { orderPreviewPage, OrderPreviewQueryError } from './OrderPreviewFixtures.ts';
import { productPreviewPage, ProductPreviewQueryError } from './ProductPreviewFixtures.ts';
import { voucherPreviewPage } from './VoucherPreviewFixtures.ts';

const port = Number(process.env.CONSOLE_PREVIEW_API_PORT ?? 4311);
const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' });
const previewTenant = Object.freeze({ kind: 'tenant', id: 'tenant:smart-wing', name: '智慧翼租户' });
const previewMall = Object.freeze({
  kind: 'mall', id: 'mall:console', name: '主打团商城', tenant: previewTenant.id,
  path: [{ kind: 'platform', id: previewScope.id }, { kind: 'tenant', id: previewTenant.id }],
});
const ownerScopeKinds = new Set(['platform', 'tenant', 'mall', 'self']);
const ownerOperations = OperationCatalog.all().filter((operation) =>
  (operation.audience === 'operator' || operation.audience === 'member')
    && operation.scopeKinds.some((kind) => ownerScopeKinds.has(kind)));
const previewSession = Object.freeze({
  ...consoleSession,
  actor: 'actor:owner:ethan:preview',
  membership: 'membership-platform-owner-ethan-v1',
  scope: previewScope,
  scopes: [previewScope],
  permissions: [...new Set(ownerOperations.flatMap((operation) => operation.permission === undefined ? [] : [operation.permission]))].sort(),
  capabilities: ownerOperations.map((operation) => operation.id).sort(),
  assurance: { level: 3, verified: 'owner-preview' },
  csrf: 'owner-preview-csrf-token',
});
const accessPreviewPage = Object.freeze({
  items: [
    { id: previewSession.membership, status: 'active', access_version: 1,
      roles: [{ role: 'role-platform-owner-v2', name: 'Root Owner' }],
      scopes: [{ id: 'scope:owner:platform', kind: 'platform', scope: previewScope.id, effect: 'allow', expires: null }] },
    { id: 'membership:admin:preview', status: 'active', access_version: 3,
      roles: [{ role: 'role-tenant-admin-preview', name: '租户管理员' }],
      scopes: [{ id: 'scope:admin:tenant', kind: 'tenant', scope: previewTenant.id, effect: 'allow', expires: null }] },
  ],
  count: 2,
});
const memberPreviewPage = Object.freeze({
  items: [
    { id: 'member:owner:ethan', display_name: 'Ethan', status: 'active', membership_id: previewSession.membership,
      employee_no: 'OWNER', membership_status: 'active', access_version: 1, joined_at: '2026-08-01T00:00:00.000Z',
      principal_id: previewSession.actor, principal_version: 1, client: 'operator', login_identity_bound: true,
      reset_allowed: false, reset_block_reason: 'OWNER_PROTECTED' },
    { id: 'member:admin:preview', display_name: '本地验收管理员', status: 'active', membership_id: 'membership:admin:preview',
      employee_no: 'PREVIEW001', membership_status: 'active', access_version: 3, joined_at: '2026-08-20T00:00:00.000Z',
      principal_id: 'principal:admin:preview', principal_version: 2, client: 'operator', login_identity_bound: true,
      reset_allowed: true, reset_block_reason: null },
  ],
  count: 2,
});
const channelPreviewPages = Object.freeze({
  connections: { items: [{ id: 'connection:meal:preview', provider: 'meal', status: 'active', contract_version: 'v2',
    region: 'cn-hangzhou', max_concurrency: 8, max_attempts: 3, failure_threshold: 5, recovery_ms: 30_000,
    version: 7, updated_at: '2026-08-30T03:30:00.000Z', has_secret: true }], count: 1 },
  syncs: { items: [{ id: 'sync:meal:preview', connection_id: 'connection:meal:preview', kind: 'catalog', state: 'completed',
    pulled_count: 128, accepted_count: 126, rejected_count: 2, watermark: 'preview:128',
    started_at: '2026-08-30T03:20:00.000Z', completed_at: '2026-08-30T03:21:12.000Z' }], count: 1 },
  operations: { items: [{ id: 'operation:meal:preview', provider: 'meal', kind: 'order.push',
    internal_reference: 'order:preview:1001', external_reference: 'MEAL-20260830-1001', state: 'succeeded',
    created_at: '2026-08-30T03:25:00.000Z', updated_at: '2026-08-30T03:25:03.000Z' }], count: 1 },
});
const qualificationPreviewPage = Object.freeze({ items: [{
  id: 'qualification:employee-benefit:preview', name: '员工福利资格', status: 'published', active_version: 3,
  updated_at: '2026-08-30T03:00:00.000Z', published_at: '2026-08-29T08:00:00.000Z',
  rule: { employmentStatus: 'active', minimumTenureDays: 30 },
}], count: 1 });
const supportPreviewCase = Object.freeze({
  id: 'case:benefit-1001', conversation_id: 'conversation:benefit-1001', priority: 'high', skill: '福利售后', state: 'open',
  assigned_agent_id: 'agent:wing-07', response_due_at: '2026-08-30T10:30:00.000Z', resolution_due_at: '2026-08-30T16:00:00.000Z',
  created_at: '2026-08-30T08:00:00.000Z', updated_at: '2026-08-30T09:15:00.000Z', version: 12,
  subject: '中秋礼盒兑换码无法使用', member_id: 'member:10086', order_id: 'order:SW-20260830-1001', channel: 'wechat',
});
const supportPreviewMessages = Object.freeze([
  { id: 'message:customer-1', authorType: 'member', author: 'member:10086', body: '兑换时提示兑换码无效，请帮我查一下。', createdAt: '2026-08-30T09:10:00.000Z' },
  { id: 'message:agent-1', authorType: 'agent', author: 'agent:wing-07', body: '已经收到，我正在核对该订单。', createdAt: '2026-08-30T09:12:00.000Z' },
]);
const reportPreviewPage = Object.freeze({ items: [{
  code: 'preview.metric', version: 3, scope: previewScope.id,
  period: { from: '2026-08-24', to: '2026-08-30', timezone: 'Asia/Shanghai' },
  dimensions: { mall: previewMall.name }, value: 2_486_320, unit: 'minor',
  watermark: '2026-08-30T03:30:00.000Z', projectionVersion: 12,
}], count: 1 });
const financeStatementPreviewPage = Object.freeze({ items: [{ id: 'statement:preview:202608', period_start: '2026-08-01',
  period_end: '2026-08-31', currency: 'CNY', opening_minor: 1_280_000, debit_minor: 860_000, credit_minor: 640_000,
  closing_minor: 1_500_000, state: 'generated', generated_at: '2026-08-30T03:00:00.000Z' }], count: 1 });
const financeWithdrawalPreviewPage = Object.freeze({ items: [{ id: 'withdrawal:preview:1001', settlement_id: 'settlement:preview:1001',
  source_kind: 'settlement', source_id: 'settlement:preview:1001', beneficiary_member_id: 'member:admin:preview',
  amount_minor: 86_000, currency: 'CNY', state: 'pending_review', created_at: '2026-08-30T03:10:00.000Z', version: 2 }], count: 1 });
const invoicePreviewPage = Object.freeze({ items: [{ id: 'invoice:preview:1001', profile_id: 'invoice-profile:preview',
  amount_minor: 128_000, currency: 'CNY', state: 'requested', created_at: '2026-08-30T03:12:00.000Z', version: 1,
  settlement_id: 'settlement:preview:1001', issued_at: null }], count: 1 });
const notificationTemplatePreviewPage = Object.freeze({ items: [{ id: 'notification-template:preview:order-paid', channel: 'wechat',
  event_type: 'order.paid', version: 4, subject: '订单支付成功通知', status: 'active', created_at: '2026-08-20T08:00:00.000Z' }], count: 1 });
const announcementPreviewPage = Object.freeze({ items: [{ id: 'announcement:preview:mid-autumn', title: '中秋福利领取提醒', state: 'scheduled',
  starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2026-09-15T23:59:59.000Z', version: 2,
  updated_at: '2026-08-30T03:15:00.000Z' }], count: 1 });
const importPreviewJob = Object.freeze({ id: 'job:preview:1001', state: 'completed', total_count: 500,
  cursor_value: 500, success_count: 498, failure_count: 2, validation_summary: { valid: 498, invalid: 2 },
  last_error: null, report_object_ref: 'preview://imports/job-1001.csv', report_sha256: 'a'.repeat(64), report_size: 2048,
  created_at: '2026-08-30T02:00:00.000Z', updated_at: '2026-08-30T02:01:20.000Z',
  errors: [{ row_number: 17, reason_code: 'MEMBER_ID_INVALID', field: 'member_id', detail: '预览错误行' }],
});
const referralSettingPreview = Object.freeze({ id: 'referral-setting:mall:console', scope_id: previewMall.id, enabled: true,
  recruit_enabled: true, review_required: true, reward_enabled: true, binding_mode: 'permanent', binding_days: null,
  settle_trigger: 'on_received', settle_delay_days: 7, withdraw_min_minor: 5000, withdraw_monthly_max: 3,
  created_at: '2026-08-01T00:00:00.000Z', updated_at: '2026-08-29T00:00:00.000Z', version: 4, persisted: true });
const referralProductPreviewPage = Object.freeze({ items: [{ id: 'referral-product:coffee', scope_id: previewMall.id,
  sku_id: 'sku:coffee', code: 'COFFEE-01', product_id: 'product:coffee', listing_id: 'listing:coffee', title: '精选咖啡礼盒',
  listing_status: 'published', commission_bps: 1200, reward_bps: 300, enabled: true,
  created_at: '2026-08-20T00:00:00.000Z', updated_at: '2026-08-29T00:00:00.000Z', version: 2 }], count: 1 });
const referralMemberPreview = Object.freeze({ id: 'referral-member:pending', scope_id: previewMall.id, member_id: 'member:pending',
  display_name: '待审核会员', inviter_member_id: 'referral-member:parent', inviter_profile_id: 'member:parent',
  inviter_display_name: '一级邀请人', state: 'pending', approved_by: null, approved_at: null,
  created_at: '2026-08-29T01:00:00.000Z', updated_at: '2026-08-29T01:00:00.000Z', version: 0 });
const referralBindingPreviewPage = Object.freeze({ items: [{ id: 'referral-binding:preview', scope_id: previewMall.id,
  customer_member_id: 'member:customer', customer_display_name: '商城会员', referral_member_id: 'member:referral',
  referral_profile_id: 'profile:referral', referral_display_name: '导购会员', bound_at: '2026-08-20T00:00:00.000Z',
  expires_at: null, created_at: '2026-08-20T00:00:00.000Z', updated_at: '2026-08-29T00:00:00.000Z', version: 1 }], count: 1 });
const referralCommissionBase = Object.freeze({ scope_id: previewMall.id, order_line_id: 'line:1', sku_id: 'sku:coffee',
  beneficiary_member_id: 'member:referral', beneficiary_display_name: '导购会员', kind: 'commission', currency: 'CNY',
  base_minor: 10_000, rate_bps: 1000, reversed_base_minor: 0, reversed_minor: 0, claimed_minor: 500, recovery_minor: 0,
  origin_event_id: 'event:paid', setting_version: 4, product_version: 2, settle_trigger: 'on_received', settle_delay_days: 7,
  reversal_journal_id: null, reversal_event_id: null, reversed_at: null, created_at: '2026-08-20T00:00:00.000Z',
  updated_at: '2026-08-29T00:00:00.000Z', version: 2 });
const referralCommissionPreviewPage = Object.freeze({ items: [
  { ...referralCommissionBase, id: 'referral-commission:settled', order_id: 'order:settled', amount_minor: 7000,
    withdrawable_minor: 6500, state: 'settled', eligible_at: '2026-08-27T00:00:00.000Z', journal_id: 'journal:settled',
    settling_at: '2026-08-28T00:00:00.000Z', settled_at: '2026-08-29T00:00:00.000Z' },
  { ...referralCommissionBase, id: 'referral-commission:pending', order_id: 'order:pending', amount_minor: 2000,
    claimed_minor: 0, withdrawable_minor: 0, state: 'pending', eligible_at: null, journal_id: null, settling_at: null, settled_at: null },
], count: 2 });

const server = createServer((request, response) => {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
  const route = `${request.method ?? 'GET'} ${url.pathname}`;
  if (route === 'GET /api/v1/catalog/listings') {
    try {
      send(response, productPreviewPage(url.searchParams));
    } catch (cause) {
      if (cause instanceof ProductPreviewQueryError) {
        send(response, { code: cause.code }, cause.status);
        return;
      }
      throw cause;
    }
    return;
  }
  if (route === 'GET /api/v1/orders') {
    try {
      send(response, orderPreviewPage(url.searchParams));
    } catch (cause) {
      if (cause instanceof OrderPreviewQueryError) {
        send(response, { code: cause.code }, cause.status);
        return;
      }
      throw cause;
    }
    return;
  }
  if (route === 'GET /api/v1/finance/overview') {
    send(response, financePreviewOverview);
    return;
  }
  if (route === 'GET /api/v1/finance/reconciliations') {
    try {
      send(response, financeReconciliationPreviewPage(url.searchParams));
    } catch (cause) {
      if (cause instanceof FinancePreviewQueryError) {
        send(response, { code: cause.code }, cause.status);
        return;
      }
      throw cause;
    }
    return;
  }
  if (route === 'GET /api/v1/finance/entries') {
    send(response, financePreviewEntriesPage);
    return;
  }
  if (route === 'GET /api/v1/finance/settlements') {
    send(response, financePreviewSettlementsPage);
    return;
  }
  if (route === 'GET /api/v1/finance/policies' || route === 'GET /api/v1/finance/audits') {
    try {
      send(response, route.endsWith('/policies') ? financePolicyPreviewPage(url.searchParams) : financeAuditPreviewPage(url.searchParams));
    } catch (cause) {
      if (cause instanceof FinancePreviewQueryError) {
        send(response, { code: cause.code }, cause.status);
        return;
      }
      throw cause;
    }
    return;
  }
  if (route === 'GET /api/v1/experiences/applications') {
    send(response, applicationPreviewPage);
    return;
  }
  if (route === 'GET /api/v1/vouchers/programs') {
    send(response, voucherPreviewPage('programs'));
    return;
  }
  if (route === 'GET /api/v1/vouchers/cardlibraries') {
    send(response, voucherPreviewPage('cardlibraries'));
    return;
  }
  if (route === 'GET /api/v1/vouchers/reserves') {
    send(response, voucherPreviewPage('reserves'));
    return;
  }
  if (route === 'GET /api/v1/vouchers/batches') {
    send(response, voucherPreviewPage('batches'));
    return;
  }
  if (/^\/api\/v1\/support\/cases\/[^/]+\/messages$/.test(url.pathname)) {
    if (request.method === 'GET') send(response, { items: supportPreviewMessages, count: supportPreviewMessages.length, attachments: [] });
    else if (request.method === 'POST') send(response, { id: 'message:owner-preview', status: 'preview', persisted: false }, 201);
    else send(response, { code: 'PREVIEW_METHOD_NOT_REGISTERED' }, 405);
    return;
  }
  if (request.method === 'GET' && /^\/api\/v1\/(?:members|catalog|vouchers)\/imports\/[^/]+$/.test(url.pathname)) {
    send(response, importPreviewJob);
    return;
  }
  const result = responses.get(route);

  if (result === undefined) {
    send(response, { code: 'PREVIEW_OPERATION_NOT_REGISTERED', method: request.method, path: url.pathname }, 501);
    return;
  }

  send(response, result);
});

const responses = new Map([
  ['GET /api/v1/identity/session', previewSession],
  ['GET /api/v1/members/me', { display_name: 'Ethan', employee_no: 'OWNER' }],
  ['GET /api/v1/organizations/layers', { items: [previewTenant, previewMall], count: 2 }],
  ['GET /api/v1/access/center', accessPreviewPage],
  ['GET /api/v1/members', memberPreviewPage],
  ['GET /api/v1/channels/connections', channelPreviewPages.connections],
  ['GET /api/v1/channels/syncruns', channelPreviewPages.syncs],
  ['GET /api/v1/channels/operations', channelPreviewPages.operations],
  ['GET /api/v1/qualifications', qualificationPreviewPage],
  ['GET /api/v1/support/cases', { items: [supportPreviewCase], count: 1 }],
  ['GET /api/v1/reports/sales', reportPreviewPage],
  ['GET /api/v1/reports/products', reportPreviewPage],
  ['GET /api/v1/reports/malls', reportPreviewPage],
  ['GET /api/v1/reports/categories', reportPreviewPage],
  ['GET /api/v1/reports/channels', reportPreviewPage],
  ['GET /api/v1/reports/powderclass', reportPreviewPage],
  ['GET /api/v1/reports/voucherconsumption', reportPreviewPage],
  ['GET /api/v1/finance/statements', financeStatementPreviewPage],
  ['GET /api/v1/finance/withdrawals', financeWithdrawalPreviewPage],
  ['GET /api/v1/invoices/requests', invoicePreviewPage],
  ['GET /api/v1/notifications/templates', notificationTemplatePreviewPage],
  ['GET /api/v1/notifications/announcements', announcementPreviewPage],
  ['GET /api/v1/referral/settings', referralSettingPreview],
  ['GET /api/v1/referral/products', referralProductPreviewPage],
  ['GET /api/v1/referral/members', { items: [referralMemberPreview], count: 1 }],
  ['GET /api/v1/referral/bindings', referralBindingPreviewPage],
  ['GET /api/v1/referral/commissions', referralCommissionPreviewPage],
  ['POST /api/v1/referral/members/approve', referralDecisionPreview('active')],
  ['POST /api/v1/referral/members/disqualify', referralDecisionPreview('disqualified')],
  ['GET /api/v1/reports/dashboard', cockpit],
  ['GET /health/dependency', controlHealth],
]);

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`CONSOLE_PREVIEW_API_READY http://127.0.0.1:${port}\n`);
});

function send(response, body, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function setCors(request, response) {
  response.setHeader('access-control-allow-origin', request.headers.origin ?? 'http://127.0.0.1:4173');
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('access-control-allow-headers', 'accept,content-type,idempotency-key,if-match,x-access-version,x-action-proof,x-client-version,x-contract-version,x-csrf-token,x-scope-hint,x-trace-id');
}

function referralDecisionPreview(state) {
  return { id: referralMemberPreview.id, scope_id: referralMemberPreview.scope_id, member_id: referralMemberPreview.member_id,
    inviter_member_id: referralMemberPreview.inviter_member_id, state, approved_by: previewSession.actor,
    approved_at: '2026-08-30T04:00:00.000Z', created_at: referralMemberPreview.created_at,
    updated_at: '2026-08-30T04:00:00.000Z', version: 1 };
}
