import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Container } from '../../src/bootstrap/Container';
import type { ModuleContext } from '../../src/bootstrap/ModuleRegistry';
import type { AuditSink } from '../../src/foundation/application/AuditSink';
import { AUDIT_SINK } from '../../src/foundation/application/AuditSink';
import type { OperationRequest, OperationResult } from '../../src/foundation/application/OperationHandler';
import { KMS_CLIENT, type KmsClient } from '../../src/foundation/infrastructure/KmsClient';
import { DATABASE_POOL, createPool, type DatabasePool } from '../../src/foundation/persistence/Pool';
import { DECISION_SINK, type DecisionSink } from '../../src/foundation/security/DecisionSink';
import { RISK_GATE, type RiskGate } from '../../src/foundation/security/RiskGate';
import { cartOperations } from '../../src/modules/cart/CartOperations';
import { PAYMENT_GATEWAY, type PaymentGateway } from '../../src/modules/payment/application/port/PaymentGateway';
import { PaymentJobProcessor } from '../../src/modules/payment/PaymentJobs';
import { webCatalogOperations } from '../../src/modules/webbusiness/WebCatalogOperations';
import { webInventoryOperations } from '../../src/modules/webbusiness/WebInventoryOperations';
import { webPricingOperations } from '../../src/modules/webbusiness/WebPricingOperations';
import {
  PURCHASE_QUOTE_KEY,
  purchaseCheckoutOperations,
  purchaseOrderOperations,
  purchasePaymentOperations,
} from '../../src/modules/purchase/PurchaseOperations';

const adminConnection = process.env.SHOP_TEST_ADMIN_DATABASE_URL;
const webConnection = process.env.SHOP_TEST_WEB_DATABASE_URL;
const purchaseConnection = process.env.SHOP_TEST_PURCHASE_DATABASE_URL;
const jobConnection = process.env.SHOP_TEST_JOB_DATABASE_URL;
const endpointAvailable = adminConnection !== undefined && webConnection !== undefined && purchaseConnection !== undefined
  && jobConnection !== undefined;

interface PublicMallFixture {
  readonly enterprise: string;
  readonly mall: string;
  readonly otherMall: string;
  readonly principal: string;
  readonly member: string;
  readonly membership: string;
  readonly session: string;
  readonly assurance: string;
  readonly federatedIdentity: string;
  readonly category: string;
  readonly product: string;
  readonly sku: string;
  readonly pool: string;
  readonly otherPool: string;
  readonly listing: string;
  readonly otherListing: string;
  readonly pricebook: string;
  readonly price: string;
  readonly stock: string;
  readonly application: string;
  readonly version: string;
  readonly release: string;
  readonly publication: string;
  readonly address: string;
}

describe.runIf(endpointAvailable)('public Mall Core checkout on PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '');
  const fixture: PublicMallFixture = Object.freeze({
    enterprise: `enterprise:public:${suffix}`,
    mall: `mall:public:${suffix}`,
    otherMall: `mall:other:${suffix}`,
    principal: `principal:public:${suffix}`,
    member: `member:public:${suffix}`,
    membership: `membership:public:${suffix}`,
    session: `session:public:${suffix}`,
    assurance: `assurance:public:${suffix}`,
    federatedIdentity: `federated:public:${suffix}`,
    category: `category:public:${suffix}`,
    product: `product:public:${suffix}`,
    sku: `sku:public:${suffix}`,
    pool: `pool:public:${suffix}`,
    otherPool: `pool:other:${suffix}`,
    listing: `listing:public:${suffix}`,
    otherListing: `listing:other:${suffix}`,
    pricebook: `pricebook:public:${suffix}`,
    price: `price:public:${suffix}`,
    stock: `stock:public:${suffix}`,
    application: `application:public:${suffix}`,
    version: `experienceversion:public:${suffix}`,
    release: `release:public:${suffix}`,
    publication: `publication:public:${suffix}`,
    address: `address:public:${suffix}`,
  });
  const quoteKey = `PublicMallQuote${suffix}A`;
  let admin: Client;
  let webPool: DatabasePool;
  let purchasePool: DatabasePool;
  let jobPool: DatabasePool;
  let cart: ReturnType<typeof cartOperations>;
  let catalog: ReturnType<typeof webCatalogOperations>;
  let pricing: ReturnType<typeof webPricingOperations>;
  let inventory: ReturnType<typeof webInventoryOperations>;
  let checkout: ReturnType<typeof purchaseCheckoutOperations>;
  let order: ReturnType<typeof purchaseOrderOperations>;
  let payment: ReturnType<typeof purchasePaymentOperations>;
  let paymentJob: PaymentJobProcessor;
  let gateway: PaymentGateway;
  let prepayCalls = 0;

  beforeAll(async () => {
    admin = new Client({ connectionString: adminConnection, connectionTimeoutMillis: 5_000, statement_timeout: 20_000 });
    await admin.connect();
    await seed(admin, fixture);
    webPool = createPool(webConnection!, 'api');
    purchasePool = createPool(purchaseConnection!, 'api');
    jobPool = createPool(jobConnection!, 'jobs');
    cart = cartOperations(context(webPool));
    catalog = webCatalogOperations(context(webPool));
    pricing = webPricingOperations(context(webPool));
    inventory = webInventoryOperations(context(webPool));
    checkout = purchaseCheckoutOperations(context(purchasePool, quoteKey));
    order = purchaseOrderOperations(context(purchasePool, quoteKey));
    gateway = publicMallGateway(suffix, () => { prepayCalls += 1; });
    payment = purchasePaymentOperations(paymentContext(purchasePool, quoteKey, gateway));
    paymentJob = new PaymentJobProcessor(jobPool, gateway, 'paymentquery');
  });

  afterAll(async () => {
    await Promise.all([webPool?.end(), purchasePool?.end(), jobPool?.end()]);
    await admin?.end();
  });

  it('uses the Web role to browse one mall, create its cart, and reject another mall listing atomically', async () => {
    const listings = await catalog.invoke(request('catalog.listings.read', {}, {}, `browse:${suffix}`));
    expect(listings).toMatchObject({ status: 200, body: { items: [{ id: fixture.listing, sku_id: fixture.sku }] } });
    expect(JSON.stringify(listings)).not.toContain(fixture.otherListing);
    const offers = await pricing.invoke(request('pricing.offers.read', {}, {}, `offers:${suffix}`, { sku: fixture.sku }));
    expect(offers).toMatchObject({ status: 200, body: { items: [{ sku_id: fixture.sku, amount_minor: '2590' }] } });
    const availability = await inventory.invoke(request('inventory.availability.read', {}, {}, `stock:${suffix}`, { sku: fixture.sku }));
    expect(availability).toMatchObject({ status: 200, body: { items: [{ sku_id: fixture.sku, available: '95' }] } });

    const added = await cart.invoke(request('cart.items.put', { quantity: 2 }, { listingid: fixture.listing }, `cart:${suffix}`));
    expect(added).toMatchObject({ status: 200, body: { member_id: fixture.member, mall_id: fixture.mall, state: 'active', version: '1' } });

    await expect(cart.invoke(request('cart.items.put', { quantity: 1 }, { listingid: fixture.otherListing }, `cross:${suffix}`)))
      .rejects.toThrow('LISTING_NOT_PURCHASABLE');
    const evidence = (await admin.query<{ own: number; foreign: number }>(`select
      (select count(*)::integer from cart.item item join cart.cart cart on cart.id=item.cart_id
        where cart.member_id=$1 and cart.mall_id=$2 and item.listing_id=$3) own,
      (select count(*)::integer from cart.item item join cart.cart cart on cart.id=item.cart_id
        where cart.member_id=$1 and item.listing_id=$4) foreign`,
    [fixture.member, fixture.mall, fixture.listing, fixture.otherListing])).rows[0];
    expect(evidence).toEqual({ own: 1, foreign: 0 });
  });

  it('quotes, orders, and creates one WeChat prepay exactly once under the Purchase role', async () => {
    const quoted = await checkout.invoke(request('checkout.quote.create', {
      address: fixture.address,
      delivery: { mode: 'express' },
      vouchers: [],
      benefits: [],
    }, {}, `quote:${suffix}`));
    const quote = quoteId(quoted);
    expect(quoted).toMatchObject({ status: 201, body: { quote: { id: quote, payableMinor: 5180, personalMinor: 5180 } } });

    const command = request('order.orders.create', { quote }, {}, `order:${suffix}`);
    const [first, replay] = await Promise.all([order.invoke(command), order.invoke(command)]);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ status: 201, body: { paymentState: 'unpaid', lifecycleState: 'created',
      payment: { personalMinor: 5180, action: 'payment.intents.create' } } });
    const orderId = String((first.body as Record<string, unknown>).id);

    const evidence = (await admin.query<{
      orders: number; lines: number; reservations: number; reservation_mall: string; checkout_state: string;
      cart_state: string; intents: number; intent_mall: string; tender_kind: string; tender_state: string;
    }>(`select
      (select count(*)::integer from ordering.orderrecord where id=$1 and mall_id=$2) orders,
      (select count(*)::integer from ordering.line where order_id=$1) lines,
      (select count(*)::integer from inventory.reservation where owner_id=$1 and mall_id=$2) reservations,
      (select mall_id from inventory.reservation where owner_id=$1) reservation_mall,
      (select state from checkout.session where quote_id=$3) checkout_state,
      (select state from cart.cart where member_id=$4 and mall_id=$2 order by updated_at desc limit 1) cart_state,
      (select count(*)::integer from payment.intent where order_id=$1 and mall_id=$2) intents,
      (select mall_id from payment.intent where order_id=$1) intent_mall,
      (select tender.kind from payment.intenttender tender join payment.intent intent
        on intent.mall_id=tender.mall_id and intent.id=tender.intent_id where intent.order_id=$1) tender_kind,
      (select tender.state from payment.intenttender tender join payment.intent intent
        on intent.mall_id=tender.mall_id and intent.id=tender.intent_id where intent.order_id=$1) tender_state`,
    [orderId, fixture.mall, quote, fixture.member])).rows[0];
    expect(evidence).toEqual({
      orders: 1,
      lines: 1,
      reservations: 1,
      reservation_mall: fixture.mall,
      checkout_state: 'confirmed',
      cart_state: 'converted',
      intents: 1,
      intent_mall: fixture.mall,
      tender_kind: 'wechat',
      tender_state: 'planned',
    });

    const paymentCommand = request('payment.intents.create', { order: orderId, scene: 'jsapi' }, {}, `payment:${suffix}`);
    const prepared = await payment.invoke(paymentCommand);
    const replayed = await payment.invoke(paymentCommand);
    expect(replayed).toEqual(prepared);
    expect(prepared).toMatchObject({ status: 201, body: { parameters: {
      package: 'prepay_id=public-mall', providerRequestId: `provider:${suffix}`,
    } } });
    expect(prepayCalls).toBe(1);

    const paymentEvidence = (await admin.query<{
      payment_state: string; intent_state: string; attempts: number; attempt_state: string;
      attempt_mall: string; prepays: number; prepay_mall: string; recovery_jobs: number;
    }>(`select
      (select payment_state from ordering.orderrecord where id=$1) payment_state,
      (select state from payment.intent where order_id=$1 and mall_id=$2) intent_state,
      (select count(*)::integer from payment.attempt attempt join payment.intent intent
        on intent.mall_id=attempt.mall_id and intent.id=attempt.intent_id where intent.order_id=$1) attempts,
      (select attempt.state from payment.attempt attempt join payment.intent intent
        on intent.mall_id=attempt.mall_id and intent.id=attempt.intent_id where intent.order_id=$1) attempt_state,
      (select attempt.mall_id from payment.attempt attempt join payment.intent intent
        on intent.mall_id=attempt.mall_id and intent.id=attempt.intent_id where intent.order_id=$1) attempt_mall,
      (select count(*)::integer from payment.prepay prepay join payment.intent intent
        on intent.mall_id=prepay.mall_id and intent.id=prepay.intent_id where intent.order_id=$1) prepays,
      (select prepay.mall_id from payment.prepay prepay join payment.intent intent
        on intent.mall_id=prepay.mall_id and intent.id=prepay.intent_id where intent.order_id=$1) prepay_mall,
      (select count(*)::integer from runtime.job where kind='paymentquery' and scope_id=$2 and payload->>'intent'=
        (select id from payment.intent where order_id=$1 and mall_id=$2)) recovery_jobs`, [orderId, fixture.mall])).rows[0];
    expect(paymentEvidence).toEqual({
      payment_state: 'authorizing', intent_state: 'authorizing', attempts: 1, attempt_state: 'pending',
      attempt_mall: fixture.mall, prepays: 1, prepay_mall: fixture.mall, recovery_jobs: 1,
    });

    const intent = String((prepared.body as { intent?: unknown }).intent);
    const paymentQuery = {
      id: `job:query:${intent}`, kind: 'paymentquery', scope_id: fixture.mall, payload: { intent }, attempts: 0,
    };
    await paymentJob.process(paymentQuery, new AbortController().signal);
    await paymentJob.process(paymentQuery, new AbortController().signal);

    const paidEvidence = (await admin.query<{
      payment_state: string; lifecycle_state: string; fulfillment_state: string; intent_state: string;
      tender_state: string; attempt_state: string; payments: number; captures: number; allocations: number;
      reservation_state: string; onhand: number; fulfillments: number; fulfillment_mall: string;
      payment_events: number; order_events: number;
    }>(`select
      (select payment_state from ordering.orderrecord where id=$1) payment_state,
      (select lifecycle_state from ordering.orderrecord where id=$1) lifecycle_state,
      (select fulfillment_state from ordering.orderrecord where id=$1) fulfillment_state,
      (select state from payment.intent where id=$2 and mall_id=$3) intent_state,
      (select state from payment.intenttender where intent_id=$2 and mall_id=$3 and kind='wechat') tender_state,
      (select state from payment.attempt where intent_id=$2 and mall_id=$3) attempt_state,
      (select count(*)::integer from payment.payment where intent_id=$2 and mall_id=$3) payments,
      (select count(*)::integer from payment.capture where order_id=$1 and mall_id=$3) captures,
      (select count(*)::integer from payment.allocation where target_id=$1 and mall_id=$3) allocations,
      (select state from inventory.reservation where owner_id=$1 and mall_id=$3) reservation_state,
      (select onhand::float8 from inventory.stockitem where id=$4 and scope_id=$3) onhand,
      (select count(*)::integer from fulfillment.fulfillmentorder where order_id=$1 and mall_id=$3) fulfillments,
      (select mall_id from fulfillment.fulfillmentorder where order_id=$1 and mall_id=$3) fulfillment_mall,
      (select count(*)::integer from runtime.outbox where event_type='payment.succeeded' and scope_id=$3
        and payload->>'order'=$1) payment_events,
      (select count(*)::integer from runtime.outbox where event_type='order.paid' and scope_id=$3
        and aggregate_id=$1) order_events`, [orderId, intent, fixture.mall, fixture.stock])).rows[0];
    expect(paidEvidence).toEqual({
      payment_state: 'paid', lifecycle_state: 'active', fulfillment_state: 'allocated', intent_state: 'captured',
      tender_state: 'captured', attempt_state: 'succeeded', payments: 1, captures: 1, allocations: 1,
      reservation_state: 'committed', onhand: 98, fulfillments: 1, fulfillment_mall: fixture.mall,
      payment_events: 1, order_events: 1,
    });
  });

  it('keeps authority tables closed while exposing only the three Purchase projections', async () => {
    const boundary = (await admin.query<{ web_membership: boolean; web_checkout: boolean; purchase_membership: boolean;
      purchase_checkout: boolean; purchase_quote: boolean; purchase_payment: boolean }>(`select
      has_table_privilege('zhudatuanwebapi','access.membership','SELECT') web_membership,
      has_function_privilege('zhudatuanwebapi','access.purchase_checkout_context(text,text,text,text)','EXECUTE') web_checkout,
      has_table_privilege('zhudatuanpurchaseapi','access.membership','SELECT') purchase_membership,
      has_function_privilege('zhudatuanpurchaseapi','access.purchase_checkout_context(text,text,text,text)','EXECUTE') purchase_checkout,
      has_function_privilege('zhudatuanpurchaseapi','access.purchase_order_quote(text,text,text)','EXECUTE') purchase_quote,
      has_function_privilege('zhudatuanpurchaseapi',
        'access.purchase_payment_intent_context(text,text,text,text,text)','EXECUTE') purchase_payment`)).rows[0];
    expect(boundary).toEqual({ web_membership: false, web_checkout: false, purchase_membership: false,
      purchase_checkout: true, purchase_quote: true, purchase_payment: true });
  });

  function request(type: OperationRequest['type'], body: Readonly<Record<string, unknown>>, path: Readonly<Record<string, string>>,
    idempotency: string, query: Readonly<Record<string, string>> = {}): OperationRequest {
    const browsing = type === 'catalog.listings.read' || type === 'pricing.offers.read' || type === 'inventory.availability.read';
    return {
      type,
      access: {
        actor: { id: fixture.principal, session: fixture.session, membership: fixture.membership, credentialVersion: 1,
          accessVersion: 1, target: 'storefront', assurance: { level: 2 } },
        membership: { id: fixture.membership, active: true, accessVersion: 1, denies: [], grants: [] },
        scope: browsing
          ? { id: fixture.mall, kind: 'mall', tenant: fixture.enterprise, path: [] }
          : { id: fixture.member, kind: 'owner', tenant: fixture.mall, path: [] },
        mallContext: { mall_id: fixture.mall },
        mall_id: fixture.mall,
        accessVersion: 1,
        capabilities: ['catalog.listings.read', 'pricing.offers.read', 'inventory.availability.read',
          'cart.items.put', 'checkout.quote.create', 'order.orders.create', 'payment.intents.create'],
        assurance: { level: 2 },
        trace: `trace:${suffix}`,
      },
      input: {
        path,
        query,
        headers: {},
        body,
        rawBody: JSON.stringify(body),
        deadline: Date.now() + 20_000,
        signal: new AbortController().signal,
        idempotency,
      },
    };
  }
});

function context(pool: DatabasePool, quoteKey?: string): ModuleContext {
  const container = new Container();
  const audit: AuditSink = { record: async () => undefined, access: async () => undefined };
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, audit);
  if (quoteKey !== undefined) container.bind(PURCHASE_QUOTE_KEY, quoteKey);
  return { container } as unknown as ModuleContext;
}

function paymentContext(pool: DatabasePool, quoteKey: string, gateway: PaymentGateway): ModuleContext {
  const module = context(pool, quoteKey);
  const kms = { decrypt: async () => 'openid-public-mall' } as unknown as KmsClient;
  const risk: RiskGate = { evaluate: async () => ({ outcome: 'allow', safeReason: 'amount', decision: null }) };
  const decisions: DecisionSink = { append: async () => undefined };
  module.container.bind(PAYMENT_GATEWAY, gateway);
  module.container.bind(KMS_CLIENT, kms);
  module.container.bind(RISK_GATE, risk);
  module.container.bind(DECISION_SINK, decisions);
  return module;
}

function publicMallGateway(suffix: string, prepayCalled: () => void): PaymentGateway {
  return {
    application: (scene) => ({ scene, applicationHash: 'a'.repeat(64) }),
    prepay: async () => {
      prepayCalled();
      return {
        appId: 'wx-public-mall', timeStamp: '1788336000', nonceStr: 'public-mall',
        package: 'prepay_id=public-mall', signType: 'RSA', paySign: 'signed', providerRequestId: `provider:${suffix}`,
      };
    },
    query: async () => ({ state: 'succeeded', transaction: `wechat:${suffix}`, amountMinor: 5180,
      occurredAt: '2026-09-02T03:00:00Z', evidence: { source: 'public-mall-postgres-test' } }),
    close: async () => undefined,
    refund: async () => ({ state: 'processing', reference: 'refund:pending', evidence: {} }),
    queryRefund: async () => ({ state: 'processing', reference: 'refund:pending', evidence: {} }),
    verifyNotification: async () => { throw new Error('NOT_USED'); },
  };
}

function quoteId(result: OperationResult): string {
  const body = result.body as { quote?: { id?: unknown } };
  expect(result.status).toBe(201);
  expect(typeof body.quote?.id).toBe('string');
  return String(body.quote!.id);
}

async function seed(admin: Client, fixture: PublicMallFixture): Promise<void> {
  await admin.query(`insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at) values
    ($1,'enterprise','organization-platform-root','Public Mall Enterprise','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
    ($2,'mall',$1,'Public Mall','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
    ($3,'mall',$1,'Other Mall','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp())`,
  [fixture.enterprise, fixture.mall, fixture.otherMall]);
  await admin.query(`insert into organization.unitclosure(ancestor_id,descendant_id,depth) values
    ($1,$1,0),($2,$2,0),($3,$3,0),
    ('organization-platform-root',$1,1),('organization-platform-root',$2,2),('organization-platform-root',$3,2),
    ($1,$2,1),($1,$3,1)`, [fixture.enterprise, fixture.mall, fixture.otherMall]);
  await admin.query(`insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
    values($1,'active',1,clock_timestamp(),clock_timestamp(),0)`, [fixture.principal]);
  await admin.query(`insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
    values($1,$2,'Public Mall Member','active',clock_timestamp(),clock_timestamp(),0)`, [fixture.member, fixture.principal]);
  await admin.query(`insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
    values($1,$2,$3,'storefront','active',1,clock_timestamp())`, [fixture.membership, fixture.member, fixture.mall]);
  await admin.query(`insert into identity.session(id,principal_id,membership_id,token_hash,credential_version,access_version,client,
    ip_hash,user_agent,device_label,assurance_level,expires_at,last_seen_at,created_at)
    values($1,$2,$3,repeat('1',64),1,1,'storefront',repeat('2',64),'public-mall-test','postgres',2,
      clock_timestamp()+interval '1 hour',clock_timestamp(),clock_timestamp())`, [fixture.session, fixture.principal, fixture.membership]);
  await admin.query(`insert into identity.assurance(id,principal_id,session_id,method,level,evidence_hash,verified_at,expires_at)
    values($1,$2,$3,'phone_otp',2,repeat('3',64),clock_timestamp(),clock_timestamp()+interval '30 minutes')`,
  [fixture.assurance, fixture.principal, fixture.session]);
  await admin.query(`insert into identity.federatedidentity(id,principal_id,membership_id,provider,application_hash,subject_hash,
    subject_ciphertext,subject_key_version,status,bound_at,created_at,updated_at)
    values($1,$2,$3,'wechat',repeat('a',64),repeat('c',64),'ciphertext-public-mall','v1','active',clock_timestamp(),clock_timestamp(),clock_timestamp())`,
  [fixture.federatedIdentity, fixture.principal, fixture.membership]);
  await admin.query(`insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
    values($1,$2,'310000','上海市','{}','active',1,clock_timestamp())`, [fixture.member, fixture.mall]);
  await admin.query(`insert into catalog.category(id,code,name,status,sort_order) values($1,$2,'公开商城商品','active',1)`,
  [fixture.category, `public-${fixture.category.slice(-12)}`]);
  await admin.query(`insert into catalog.product(id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
    values($1,$2,'公开商城测试商品','physical','{}','active',1,clock_timestamp(),clock_timestamp())`, [fixture.product, fixture.category]);
  await admin.query(`insert into catalog.sku(id,product_id,code,specifications,status,version)
    values($1,$2,$3,'{}','active',1)`, [fixture.sku, fixture.product, `SKU-${fixture.sku.slice(-16)}`]);
  await admin.query(`insert into catalog.pool(id,scope_id,kind,name,status,version) values
    ($1,$2,'private','Public Mall Pool','active',1),($3,$4,'private','Other Mall Pool','active',1)`,
  [fixture.pool, fixture.mall, fixture.otherPool, fixture.otherMall]);
  await admin.query(`insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at) values
    ($1,$3,'included','1',clock_timestamp()),($2,$3,'included','1',clock_timestamp())`,
  [fixture.pool, fixture.otherPool, fixture.sku]);
  await admin.query(`insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at) values
    ($1,$2,'selected','active',clock_timestamp(),clock_timestamp()),
    ($3,$4,'selected','active',clock_timestamp(),clock_timestamp())`,
  [fixture.mall, fixture.pool, fixture.otherMall, fixture.otherPool]);
  await admin.query(`insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,version,created_at,updated_at) values
    ($1,$2,$3,$4,'公开商城测试商品','published',clock_timestamp(),1,clock_timestamp(),clock_timestamp()),
    ($5,$6,$7,$4,'其他商城商品','published',clock_timestamp(),1,clock_timestamp(),clock_timestamp())`,
  [fixture.listing, fixture.mall, fixture.pool, fixture.sku, fixture.otherListing, fixture.otherMall, fixture.otherPool]);
  await admin.query(`insert into pricing.pricebook(id,scope_id,currency,name,status,version)
    values($1,$2,'CNY','Public Mall Pricebook','active',1)`, [fixture.pricebook, fixture.mall]);
  await admin.query(`insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at)
    values($1,$2,$3,2590,2990,'1970-01-01T00:00:00Z')`, [fixture.price, fixture.pricebook, fixture.sku]);
  await admin.query(`insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
    values($1,$2,$3,$4,100,5,1,'active',clock_timestamp())`,
  [fixture.stock, fixture.mall, fixture.sku, `warehouse:${fixture.mall}`]);
  const contentHash = 'e'.repeat(64);
  await admin.query(`insert into experience.application(id,scope_id,name,status,created_at,updated_at,version,code,public_slug)
    values($1,$2,'Public Mall Storefront','active',clock_timestamp(),clock_timestamp(),1,$3,$4)`,
  [fixture.application, fixture.mall, `PUBLIC_${fixture.application.slice(-12).toUpperCase()}`, `public-${fixture.application.slice(-12)}`]);
  await admin.query(`insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,created_by,created_at)
    values($1,$2,1,'2',$3::jsonb,$4,'valid',$5,clock_timestamp())`,
  [fixture.version, fixture.application, JSON.stringify({ version: 2, application: fixture.application, pages: [{ id: 'home', path: '/', blocks: [] }] }),
    contentHash, fixture.principal]);
  await admin.query('update experience.application set head_version_id=$2 where id=$1', [fixture.application, fixture.version]);
  await admin.query(`insert into experience.release(id,application_id,version_id,state,effective_at,published_by)
    values($1,$2,$3,'active',clock_timestamp(),$4)`, [fixture.release, fixture.application, fixture.version, fixture.principal]);
  await admin.query(`insert into experience.binding(application_id,domain,mall_id,pool_id)
    values($1,$2,$3,$4)`, [fixture.application, `public-${fixture.application.slice(-12)}.invalid`, fixture.mall, fixture.pool]);
  await admin.query(`insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at)
    values($1,$2,$3,$4,$5,$6,$7,$5,1,'active',clock_timestamp(),clock_timestamp())`,
  [fixture.publication, fixture.release, fixture.application, fixture.version, contentHash,
    `experience/${fixture.application}/${contentHash}.json`, `object:${fixture.application}`]);
  await admin.query(`insert into checkout.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,status,version,
    recipient_masked,mobile_masked,address_masked,region_code)
    values($1,$2,'cipher:recipient','cipher:mobile','cipher:address',repeat('a',64),repeat('b',64),'active',1,
      'E**','138****0000','上海市***','310000')`, [fixture.address, fixture.member]);
}
