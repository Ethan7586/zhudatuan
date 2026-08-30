import { createServer } from 'node:http';

import { applicationPreviewPage } from './ApplicationPreviewFixtures.ts';
import { cockpit, consoleSession, controlHealth } from './Fixtures.ts';
import { financePreviewOverview, financeReconciliationPreviewPage, FinancePreviewQueryError } from './FinancePreviewFixtures.ts';
import { orderPreviewPage, OrderPreviewQueryError } from './OrderPreviewFixtures.ts';
import { productPreviewPage, ProductPreviewQueryError } from './ProductPreviewFixtures.ts';
import { referralPreviewBindings, referralPreviewCommissions, referralPreviewMembers, referralPreviewProducts, referralPreviewSetting } from './ReferralPreviewFixtures.ts';
import { voucherPreviewPage } from './VoucherPreviewFixtures.ts';

const port = Number(process.env.CONSOLE_PREVIEW_API_PORT ?? 4311);
const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' });
const referralScope = Object.freeze({ kind: 'mall', id: 'mall:console', name: '主打团示例商城' });
const referralReads = Object.freeze([
  'referral.settings.read', 'referral.products.read', 'referral.members.read',
  'referral.bindings.read', 'referral.commissions.read',
]);
const previewPermissions = Object.freeze([
  'identity.session.read', 'member.profile.read',
  'reporting.dashboard.read', 'runtime.health.read', 'catalog.listing.read', 'order.read',
  'finance.overview.read', 'finance.reconciliation.read', 'experience.application.read',
  'voucher.cardlibrary.read', 'voucher.program.read', 'voucher.reserve.read', 'voucher.batch.read',
  ...referralReads,
]);
const previewCapabilities = Object.freeze([
  'identity.session.read', 'member.profile.read',
  'reporting.dashboard.read', 'runtime.health.dependency', 'catalog.listings.read', 'order.orders.read',
  'finance.overview.read', 'finance.reconciliations.read', 'experience.applications.read',
  'voucher.cardlibraries.read', 'voucher.programs.read', 'voucher.reserves.read', 'voucher.batches.read',
  ...referralReads,
]);
const previewSession = Object.freeze({
  ...consoleSession,
  scope: previewScope,
  scopes: [previewScope, referralScope],
  permissions: previewPermissions,
  capabilities: previewCapabilities,
  assurance: { level: 2, verified: 'local-preview' },
});

const server = createServer((request, response) => {
  setCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method !== 'GET') {
    send(response, errorContract(request, 'DISPLAY_ONLY', '分销展示环境禁止写入。'), 503);
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
  if (route === 'GET /api/v1/referral/settings') {
    send(response, referralPreviewSetting);
    return;
  }
  if (route === 'GET /api/v1/referral/products') {
    send(response, page(referralPreviewProducts));
    return;
  }
  if (route === 'GET /api/v1/referral/members') {
    const state = url.searchParams.get('state');
    send(response, page(state === null ? referralPreviewMembers : referralPreviewMembers.filter((item) => item.state === state)));
    return;
  }
  if (route === 'GET /api/v1/referral/bindings') {
    send(response, page(referralPreviewBindings));
    return;
  }
  if (route === 'GET /api/v1/referral/commissions') {
    const state = url.searchParams.get('state');
    send(response, page(state === null ? referralPreviewCommissions : referralPreviewCommissions.filter((item) => item.state === state)));
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
  const result = responses.get(route);

  if (result === undefined) {
    send(response, errorContract(request, 'PREVIEW_OPERATION_FORBIDDEN', '当前预览账号尚未开通此页面。'), 403);
    return;
  }

  send(response, result);
});

const responses = new Map([
  ['GET /api/v1/identity/session', previewSession],
  ['GET /api/v1/members/me', { display_name: '本地验收管理员', employee_no: 'PREVIEW001' }],
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

function page(items) {
  return { items, count: items.length };
}

function errorContract(request, code, message) {
  return { code, message, requestId: requestId(request), retryable: false };
}

function requestId(request) {
  const header = request.headers['x-trace-id'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'referral-preview';
}

function setCors(request, response) {
  response.setHeader('access-control-allow-origin', request.headers.origin ?? 'http://127.0.0.1:4173');
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('access-control-allow-headers', 'accept,content-type,idempotency-key,if-match,x-access-version,x-action-proof,x-client-version,x-contract-version,x-csrf-token,x-scope-hint,x-trace-id');
}
