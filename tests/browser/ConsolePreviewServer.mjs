import { createServer } from 'node:http';

import { applicationPreviewPage } from './ApplicationPreviewFixtures.ts';
import { cockpit, consoleSession, controlHealth } from './Fixtures.ts';
import { financePreviewOverview, financeReconciliationPreviewPage, FinancePreviewQueryError } from './FinancePreviewFixtures.ts';
import { orderPreviewPage, OrderPreviewQueryError } from './OrderPreviewFixtures.ts';
import { productPreviewPage, ProductPreviewQueryError } from './ProductPreviewFixtures.ts';
import { voucherPreviewPage } from './VoucherPreviewFixtures.ts';

const port = Number(process.env.CONSOLE_PREVIEW_API_PORT ?? 4311);
const previewScope = Object.freeze({ kind: 'platform', id: 'platform:preview', name: '鸿泰集团' });
const previewSession = Object.freeze({ ...consoleSession, scope: previewScope, scopes: [previewScope] });

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
    send(response, { code: 'PREVIEW_OPERATION_NOT_REGISTERED', method: request.method, path: url.pathname }, 501);
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

function setCors(request, response) {
  response.setHeader('access-control-allow-origin', request.headers.origin ?? 'http://127.0.0.1:4173');
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  response.setHeader('access-control-allow-headers', 'accept,content-type,idempotency-key,if-match,x-access-version,x-action-proof,x-client-version,x-contract-version,x-csrf-token,x-scope-hint,x-trace-id');
}
