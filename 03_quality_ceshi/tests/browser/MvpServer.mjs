import { createServer } from 'node:http';

const port = Number(process.env.MVP_API_PORT ?? 4310);
let quantity = 0;
let orderCreated = false;
let paymentStartedAt = 0;
const calls = [];

const capabilities = [
  'identity.session.read', 'experience.published.read', 'catalog.listings.read', 'pricing.offers.read', 'inventory.availability.read',
  'cart.current.read', 'cart.items.put', 'checkout.quote.create', 'order.orders.create', 'order.orders.read', 'payment.intents.create',
  'member.addresses.read', 'voucher.bindings.read', 'benefit.accounts.read', 'invoice.profiles.read',
];
const permissions = [
  'identity.session.read', 'experience.published.read', 'catalog.listing.read', 'pricing.offer.read', 'inventory.read', 'cart.read', 'cart.manage',
  'checkout.create', 'order.create', 'order.read', 'payment.create', 'member.address.read', 'voucher.binding.read', 'benefit.read', 'invoice.profile.read',
];

const server = createServer(async (request, response) => {
  cors(request, response);
  if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const body = await readBody(request);
  calls.push({ method: request.method, path: url.pathname, body });
  try {
    if (request.method === 'GET' && url.pathname === '/api/v1/identity/session') return send(response, session());
    if (request.method === 'GET' && url.pathname === '/api/v1/experiences/published') return send(response, publication());
    if (request.method === 'GET' && url.pathname === '/api/v1/catalog/listings') return send(response, page(listing()));
    if (request.method === 'GET' && url.pathname === '/api/v1/pricing/offers') return send(response, page({ sku_id: 'sku:milk', amount_minor: 2590, currency: 'CNY' }));
    if (request.method === 'GET' && url.pathname === '/api/v1/inventory/availability') return send(response, page({ sku_id: 'sku:milk', available: 99 }));
    if (request.method === 'GET' && url.pathname === '/api/v1/carts/current') return send(response, cart());
    if (request.method === 'PUT' && url.pathname === '/api/v1/carts/current/items/listing%3Amilk') {
      assert(body?.quantity === 1, 'MVP_CART_QUANTITY_INVALID'); quantity = 1; return send(response, cart());
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/members/me/addresses') return send(response, page({
      id: 'address:home', recipient_masked: '王**', mobile_masked: '138****0000', address_masked: '上海市浦东新区***路',
    }));
    if (request.method === 'GET' && url.pathname === '/api/v1/vouchers/bindings') return send(response, { items: [] });
    if (request.method === 'GET' && url.pathname === '/api/v1/benefits/accounts') return send(response, { items: [] });
    if (request.method === 'GET' && url.pathname === '/api/v1/invoices/profiles') return send(response, { items: [] });
    if (request.method === 'POST' && url.pathname === '/api/v1/checkouts/quotes') {
      assert(quantity === 1 && body?.address === 'address:home' && body?.delivery?.mode === 'standard', 'MVP_QUOTE_INPUT_INVALID');
      return send(response, quote());
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/orders') {
      assert(body?.quote === 'quote:mvp', 'MVP_ORDER_QUOTE_INVALID'); orderCreated = true; return send(response, { id: 'order:mvp' }, 201);
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/orders') {
      return send(response, { items: orderCreated ? [order()] : [] });
    }
    if (request.method === 'POST' && url.pathname === '/api/v1/payments/intents') {
      assert(orderCreated && body?.order === 'order:mvp' && body?.scene === 'jsapi', 'MVP_PAYMENT_CONTEXT_INVALID');
      paymentStartedAt = Date.now();
      return send(response, { intent: 'intent:mvp', parameters: {
        appId: 'wx4df4137881a1d2bd', timeStamp: '1786665600', nonceStr: 'browserNonce1234', package: 'prepay_id=wxMvpPrepay123456',
        signType: 'RSA', paySign: 'browser-signature-evidence', providerRequestId: 'browser-provider-request',
      } }, 201);
    }
    if (request.method === 'GET' && url.pathname === '/mvp/evidence') return send(response, { calls, state: order().payment_state });
    return send(response, { code: 'MVP_ROUTE_NOT_FOUND', path: url.pathname }, 404);
  } catch (cause) {
    return send(response, { code: cause instanceof Error ? cause.message : 'MVP_SERVER_FAILED' }, 422);
  }
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`MVP_API_READY http://127.0.0.1:${port}\n`));

function session() {
  return { actor: 'principal:mvp', membership: 'membership:mvp', permissions, capabilities,
    scope: { kind: 'owner', id: 'mall:test' }, scopes: [{ kind: 'owner', id: 'mall:test' }, { kind: 'mall', id: 'mall:test' }], target: 'storefront' };
}

function publication() {
  return { hash: 'mvp-publication-20260821', document: { version: 2, application: 'application:mvp', pages: [{ id: 'home', path: '/', blocks: [{
    id: 'hero', component: 'hero', content: { eyebrow: '企业福利', title: '真实协议链路验收', description: '从商品、购物车、服务端报价到微信支付结果回读。' },
    action: { type: 'product', target: 'product:milk' },
  }] }] } };
}

function listing() { return { id: 'listing:milk', sku_id: 'sku:milk', product_id: 'product:milk', title: '有机纯牛奶礼盒', code: 'MILK-MVP' }; }
function page(item) { return { items: [item] }; }
function cart() { return { id: quantity ? 'cart:mvp' : undefined, version: quantity, items: quantity ? [{ listing: 'listing:milk', title: '有机纯牛奶礼盒', quantity }] : [] }; }
function quote() {
  return { expires_at: new Date(Date.now() + 10 * 60_000).toISOString(), quote: { id: 'quote:mvp', subtotalMinor: 2590, discountMinor: 0,
    payableMinor: 2590, personalMinor: 2590, lines: [{ listing: 'listing:milk', title: '有机纯牛奶礼盒', quantity: 1, totalMinor: 2590,
      discountMinor: 0, payableMinor: 2590, accepted: true, reasons: [] }], tenders: [{ kind: 'wechat', reference: null, amountMinor: 2590 }], rejections: [] } };
}
function order() {
  const paid = paymentStartedAt > 0 && Date.now() - paymentStartedAt >= 1_200;
  return { id: 'order:mvp', order_number: 'SW202608210001', total_minor: 2590, payment_state: paid ? 'paid' : paymentStartedAt ? 'authorizing' : 'unpaid', lifecycle_state: paid ? 'confirmed' : 'created' };
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(response, body, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function cors(request, response) {
  response.setHeader('access-control-allow-origin', request.headers.origin ?? 'http://127.0.0.1:4173');
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,OPTIONS');
  response.setHeader('access-control-allow-headers', 'accept,content-type,idempotency-key,if-match,x-client-version,x-contract-version,x-csrf-token,x-scope-hint,x-trace-id');
}

function assert(condition, code) { if (!condition) throw new Error(code); }
