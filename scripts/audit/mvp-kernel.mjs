import { createHash } from 'node:crypto';
import { Container } from '../../services/commerce/src/bootstrap/Container.ts';
import { AUDIT_SINK } from '../../services/commerce/src/foundation/application/AuditSink.ts';
import { DATABASE_POOL } from '../../services/commerce/src/foundation/persistence/Pool.ts';
import { SECURITY_KEYS } from '../../services/commerce/src/foundation/infrastructure/SecretStore.ts';
import { KMS_CLIENT } from '../../services/commerce/src/foundation/infrastructure/KmsClient.ts';
import { JobRunner } from '../../services/commerce/src/foundation/application/JobRunner.ts';
import { OutboxRelay } from '../../services/commerce/src/foundation/infrastructure/OutboxRelay.ts';
import { RuntimeEventPublisher } from '../../services/commerce/src/foundation/infrastructure/RuntimeEventPublisher.ts';
import { RecordAudit } from '../../services/commerce/src/modules/audit/application/command/RecordAudit.ts';
import { PgAuditRepository } from '../../services/commerce/src/modules/audit/infrastructure/persistence/PgAuditRepository.ts';
import { cartOperations } from '../../services/commerce/src/modules/cart/CartOperations.ts';
import { checkoutOperations } from '../../services/commerce/src/modules/checkout/CheckoutOperations.ts';
import { orderOperations } from '../../services/commerce/src/modules/order/OrderOperations.ts';
import { paymentOperations } from '../../services/commerce/src/modules/payment/PaymentOperations.ts';
import { PaymentJobProcessor } from '../../services/commerce/src/modules/payment/PaymentJobs.ts';
import { PAYMENT_GATEWAY } from '../../services/commerce/src/modules/payment/application/port/PaymentGateway.ts';
import { ReconciliationJobProcessor } from '../../services/commerce/src/modules/finance/interface/job/ReconciliationJob.ts';

const fixture = Object.freeze({
  tenant: 'mvp:tenant',
  enterprise: 'mvp:enterprise',
  mall: 'mvp:mall',
  member: 'mvp:member',
  membership: 'mvp:membership',
  application: 'mvp:application',
  version: 'mvp:experienceversion',
  release: 'mvp:release',
  publication: 'mvp:publication',
  category: 'mvp:category',
  product: 'mvp:product',
  sku: 'mvp:sku',
  pool: 'mvp:pool',
  listing: 'mvp:listing',
  pricebook: 'mvp:pricebook',
  price: 'mvp:price',
  stock: 'mvp:stock',
  address: 'mvp:address',
  applicationHash: 'e'.repeat(64),
  payer: 'openid:mvp-kernel',
});

export async function verifyMvpKernel(database) {
  await seed(database);
  const pool = pglitePool(database);
  const container = new Container();
  container.bind(DATABASE_POOL, pool);
  container.bind(AUDIT_SINK, new RecordAudit(new PgAuditRepository()));
  container.bind(
    SECURITY_KEYS,
    Object.freeze({
      identity: 'mvp-identity-key-0123456789-0123456789',
      quote: 'mvp-quote-key-0123456789-0123456789',
      session: 'mvp-session-key-0123456789-0123456789',
    })
  );
  const gateway = paymentBoundary();
  container.bind(KMS_CLIENT, Object.freeze({ decrypt: async () => fixture.payer }));
  container.bind(PAYMENT_GATEWAY, gateway);
  const context = Object.freeze({ workload: 'api', container, commands: null, queries: null, routes: null, jobs: null, extensions: null });
  const access = accessContext();

  const cart = await cartOperations(context).invoke(request('cart.items.put', access, { quantity: 2 }, { listingid: fixture.listing }, 'mvp-cart-put'));
  assert(cart.status === 200, `MVP_CART_WRITE_FAILED:${cart.status}`);
  const quote = await checkoutOperations(context).invoke(request('checkout.quote.create', access, { address: fixture.address, delivery: { mode: 'express' }, vouchers: [], benefits: [] }, {}, 'mvp-quote-create'));
  const quoteid = quote.body?.quote?.id;
  assert(quote.status === 201 && typeof quoteid === 'string', `MVP_QUOTE_FAILED:${quote.status}`);
  const order = await orderOperations(context).invoke(request('order.orders.create', access, { quote: quoteid }, {}, 'mvp-order-create'));
  assert(order.status === 201 && typeof order.body?.id === 'string', `MVP_ORDER_FAILED:${order.status}`);

  await database.exec(`begin; set local role shopapp; select set_config('app.workload','api',true),
    set_config('app.membership_id','${fixture.membership}',true),set_config('app.scope_id','${fixture.member}',true);`);
  const scopes = (
    await database.query(`select access.scope_allowed('${fixture.member}') owner,
    access.scope_allowed('${fixture.mall}') mall,access.scope_allowed('${fixture.tenant}') ancestor,
    access.scope_allowed('organization-platform-root') platform`)
  ).rows[0];
  await database.exec('commit');
  assert(scopes?.owner === true && scopes.mall === true && scopes.ancestor === false && scopes.platform === false, `MVP_MEMBER_SCOPE_INVALID:${JSON.stringify(scopes)}`);

  const evidence = await database.query(
    `select
    (select state from cart.cart where member_id=$1 and mall_id=$2 order by updated_at desc limit 1) cart_state,
    (select state from checkout.session where quote_id=$3) checkout_state,
    (select payment_state from ordering.orderrecord where id=$4) payment_state,
    (select lifecycle_state from ordering.orderrecord where id=$4) order_state,
    (select total_minor::float8 from ordering.orderrecord where id=$4) total_minor,
    (select count(*)::integer from ordering.line where order_id=$4) lines,
    (select count(*)::integer from inventory.reservation where owner_id=$4 and state='active') reservations,
    (select state from payment.intent where order_id=$4) intent_state,
    (select amount_minor::float8 from payment.intent where order_id=$4) intent_minor,
    (select tender.state from payment.intenttender tender join payment.intent intent on intent.id=tender.intent_id where intent.order_id=$4 and tender.kind='wechat') tender_state,
    (select count(*)::integer from runtime.outbox where aggregate_id in($4,(select id from checkout.session where quote_id=$3))) outbox_events,
    (select count(*)::integer from audit.record where actor_id=$1 and action in('cart.items.put','checkout.quote.create','order.orders.create')) audits,
    (select count(*)::integer from runtime.idempotency where actor_id=$1 and state='completed') idempotency_records`,
    [fixture.member, fixture.mall, quoteid, order.body.id]
  );
  const row = evidence.rows[0];
  const expected = {
    cart_state: 'converted',
    checkout_state: 'confirmed',
    payment_state: 'unpaid',
    order_state: 'created',
    total_minor: 5180,
    lines: 1,
    reservations: 1,
    intent_state: 'created',
    intent_minor: 5180,
    tender_state: 'planned',
    outbox_events: 4,
    audits: 3,
    idempotency_records: 3,
  };
  for (const [field, value] of Object.entries(expected)) assert(row?.[field] === value, `MVP_KERNEL_EVIDENCE_INVALID:${field}:${String(row?.[field])}`);
  console.log(`smart-wing MVP kernel passed: cart=converted quote=confirmed order=created payment=unpaid totalMinor=${row.total_minor} outbox=${row.outbox_events} audits=${row.audits}`);
  await verifyPayment(database, context, access, gateway, order.body.id);
}

async function verifyPayment(database, context, access, gateway, order) {
  const intent = await paymentOperations(context).invoke(request('payment.intents.create', access, { order, scene: 'jsapi' }, {}, 'mvp-payment-create'));
  assert(intent.status === 201 && typeof intent.body?.intent === 'string' && intent.body?.parameters?.package === 'prepay_id=mvp-kernel', `MVP_PAYMENT_INTENT_FAILED:${intent.status}`);
  const prepared = (
    await database.query(
      `select tender.amount_minor::float8 amount_minor,intent.currency,intent.provider_reference,
    attempt.payer_hash,attempt.scene,attempt.application_hash from payment.intent intent
    join payment.intenttender tender on tender.intent_id=intent.id and tender.kind='wechat'
    join payment.attempt attempt on attempt.intent_id=intent.id where intent.order_id=$1`,
      [order]
    )
  ).rows[0];
  const notification = await gateway.verifyNotification({}, '{}');
  for (const [field, value] of Object.entries({
    amount_minor: notification.amountMinor,
    currency: notification.currency,
    provider_reference: notification.providerReference,
    payer_hash: notification.payerHash,
    scene: notification.application.scene,
    application_hash: notification.application.applicationHash,
  }))
    assert(prepared?.[field] === value, `MVP_PAYMENT_BOUNDARY_INVALID:${field}:${String(prepared?.[field])}:${String(value)}`);
  const webhook = await paymentOperations(context).invoke(webhookRequest());
  assert(webhook.status === 204, `MVP_PAYMENT_WEBHOOK_FAILED:${webhook.status}`);
  const replay = await paymentOperations(context).invoke(webhookRequest());
  assert(replay.status === 204, `MVP_PAYMENT_WEBHOOK_REPLAY_FAILED:${replay.status}`);

  const controller = new AbortController();
  const jobPool = pglitePool(database, 'shopjob');
  const processor = new PaymentJobProcessor(jobPool, gateway, 'paymentquery');
  let paymentFailure;
  const guarded = Object.freeze({
    async process(job, signal) {
      try {
        await processor.process(job, signal);
      } catch (cause) {
        paymentFailure = cause;
        throw cause;
      } finally {
        controller.abort();
      }
    },
  });
  const runner = new JobRunner(jobPool, { worker: 'mvp:worker', owner: 'payment', batch: 1, lease: 30, concurrency: 1, attempts: 3, poll: 1, deadline: 30_000, retryMinimum: 10, retryMaximum: 100 });
  await runner.run('paymentquery', guarded, controller.signal);
  if (paymentFailure) throw paymentFailure;
  await relayAvailableEvents(jobPool);
  await runReconciliation(database, jobPool);
  await relayAvailableEvents(jobPool);

  const result = (
    await database.query(
      `select
    (select payment_state from ordering.orderrecord where id=$1) payment_state,
    (select lifecycle_state from ordering.orderrecord where id=$1) lifecycle_state,
    (select fulfillment_state from ordering.orderrecord where id=$1) fulfillment_state,
    (select state from payment.intent where order_id=$1) intent_state,
    (select attempt.state from payment.attempt attempt join payment.intent intent on intent.id=attempt.intent_id where intent.order_id=$1 order by attempt.requested_at desc limit 1) attempt_state,
    (select count(*)::integer from payment.payment payment join payment.intent intent on intent.id=payment.intent_id where intent.order_id=$1 and payment.state='captured') payments,
    (select count(*)::integer from inventory.reservation where owner_id=$1 and state='committed') committed_reservations,
    (select onhand::float8 from inventory.stockitem where id='${fixture.stock}') onhand,
    (select count(*)::integer from fulfillment.fulfillmentorder where order_id=$1) fulfillments,
    (select count(*)::integer from runtime.inbox where event_id='wechatpayment:mvp:wechat-notification') provider_inbox,
    (select count(*)::integer from runtime.job where kind='paymentquery' and state='completed') completed_payment_jobs,
    (select count(*)::integer from runtime.inbox where consumer='job:reconciliation' and event_type='payment.succeeded' and processed_at is not null) finance_inbox,
    (select count(*)::integer from runtime.job where kind='reconciliation' and state='completed'
      and payload->>'event' in('order.placed','payment.succeeded')) completed_finance_jobs,
    (select count(*)::integer from finance.journal journal join payment.payment payment on payment.id=journal.reference_id
      join payment.intent intent on intent.id=payment.intent_id where intent.order_id=$1 and journal.reference_type='payment.succeeded') journals,
    (select count(*)::integer from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
      join payment.payment payment on payment.id=journal.reference_id join payment.intent intent on intent.id=payment.intent_id
      where intent.order_id=$1 and journal.reference_type='payment.succeeded') entries,
    (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)::float8
      from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
      join payment.payment payment on payment.id=journal.reference_id join payment.intent intent on intent.id=payment.intent_id
      where intent.order_id=$1 and journal.reference_type='payment.succeeded') balance,
    (select count(*)::integer from runtime.outbox event where event.event_type='finance.entry.posted' and event.published_at is not null
      and event.payload->>'referenceId'=(select payment.id from payment.payment payment join payment.intent intent on intent.id=payment.intent_id
        where intent.order_id=$1)) finance_events,
    (select count(*)::integer from audit.record where actor_id in($2,'provider:wechat') and action in('payment.intents.create','payment.webhooks.wechat')) payment_audits`,
      [order, fixture.member]
    )
  ).rows[0];
  const expected = {
    payment_state: 'paid',
    lifecycle_state: 'active',
    fulfillment_state: 'allocated',
    intent_state: 'captured',
    attempt_state: 'succeeded',
    payments: 1,
    committed_reservations: 1,
    onhand: 98,
    fulfillments: 1,
    provider_inbox: 1,
    completed_payment_jobs: 1,
    finance_inbox: 1,
    completed_finance_jobs: 2,
    journals: 1,
    entries: 2,
    balance: 0,
    finance_events: 1,
    payment_audits: 2,
  };
  for (const [field, value] of Object.entries(expected)) assert(result?.[field] === value, `MVP_PAYMENT_EVIDENCE_INVALID:${field}:${String(result?.[field])}:${JSON.stringify(result)}`);
  console.log(`smart-wing payment kernel passed: intent=captured order=paid inventory=committed fulfillment=${result.fulfillments} webhookInbox=${result.provider_inbox}`);
  console.log(`smart-wing finance kernel passed: journal=${result.journals} entries=${result.entries} balance=${result.balance} financeInbox=${result.finance_inbox}`);
}

async function relayAvailableEvents(jobPool) {
  const relay = new OutboxRelay(jobPool, new RuntimeEventPublisher(jobPool), 'mvp:relay', 1);
  for (let index = 0; index < 64; index += 1) {
    if ((await relay.relay(1)) === 0) return;
  }
  throw new Error('MVP_OUTBOX_RELAY_DID_NOT_DRAIN');
}

async function runReconciliation(database, jobPool) {
  const queued = (await database.query("select count(*)::integer count from runtime.job where kind='reconciliation' and state='queued'")).rows[0]?.count;
  assert(typeof queued === 'number' && queued > 0, `MVP_FINANCE_JOB_INVALID:${String(queued)}`);
  const controller = new AbortController();
  const processor = new ReconciliationJobProcessor(jobPool, unavailableObjects());
  let processed = 0;
  let reconciliationFailure;
  const guarded = Object.freeze({
    async process(job, signal) {
      try {
        await processor.process(job, signal);
      } catch (cause) {
        reconciliationFailure = cause;
        throw cause;
      } finally {
        processed += 1;
        if (processed === queued) controller.abort();
      }
    },
  });
  const runner = new JobRunner(jobPool, { worker: 'mvp:finance', owner: 'finance', batch: queued, lease: 30, concurrency: 1, attempts: 3, poll: 1, deadline: 30_000, retryMinimum: 10, retryMaximum: 100 });
  await runner.run('reconciliation', guarded, controller.signal);
  if (reconciliationFailure) throw reconciliationFailure;
}

function unavailableObjects() {
  const unavailable = async () => {
    throw new Error('MVP_OBJECT_STORE_NOT_AVAILABLE');
  };
  return Object.freeze({ create: unavailable, find: unavailable, read: unavailable, inspect: unavailable, authorize: unavailable });
}

function paymentBoundary() {
  const occurredAt = new Date().toISOString();
  const boundary = {
    application(scene) {
      return Object.freeze({ scene, applicationHash: fixture.applicationHash });
    },
    async prepay(input) {
      boundary.providerReference = input.orderNumber;
      return Object.freeze({ providerRequestId: 'mvp:prepay', timeStamp: '1', nonceStr: 'mvp', package: 'prepay_id=mvp-kernel', signType: 'RSA', paySign: 'mvp-signature' });
    },
    async query(orderNumber, application) {
      assert(orderNumber === boundary.providerReference && application.applicationHash === fixture.applicationHash, 'MVP_PAYMENT_QUERY_CONTEXT_INVALID');
      return Object.freeze({ state: 'succeeded', transaction: 'mvp:wechat-transaction', amountMinor: 5180, occurredAt, evidence: Object.freeze({ verifiedBy: 'mvp-provider-query' }) });
    },
    async close() {},
    async refund() {
      return Object.freeze({ state: 'succeeded', reference: 'mvp:refund', occurredAt, evidence: Object.freeze({ verifiedBy: 'mvp-provider-refund' }) });
    },
    async queryRefund() {
      return Object.freeze({ state: 'succeeded', reference: 'mvp:refund', occurredAt, evidence: Object.freeze({ verifiedBy: 'mvp-provider-refund-query' }) });
    },
    async verifyNotification() {
      return Object.freeze({
        kind: 'payment',
        id: 'mvp:wechat-notification',
        providerReference: boundary.providerReference,
        transaction: 'mvp:wechat-transaction',
        amountMinor: 5180,
        currency: 'CNY',
        payerHash: createHash('sha256').update(fixture.payer).digest('hex'),
        application: boundary.application('jsapi'),
        occurredAt,
        evidence: Object.freeze({ verifiedBy: 'mvp-provider-boundary' }),
      });
    },
    providerReference: '',
  };
  return boundary;
}

function webhookRequest() {
  const body = JSON.stringify({ id: 'mvp:wechat-notification' });
  return Object.freeze({
    type: 'payment.webhooks.wechat',
    access: null,
    input: Object.freeze({
      path: Object.freeze({}),
      query: Object.freeze({}),
      headers: Object.freeze({ 'request-id': 'mvp:wechat-request', 'wechatpay-serial': 'mvp', 'wechatpay-timestamp': '1', 'wechatpay-nonce': 'mvp' }),
      body: null,
      rawBody: body,
      deadline: Date.now() + 30_000,
      signal: new AbortController().signal,
    }),
  });
}

function accessContext() {
  return Object.freeze({
    actor: Object.freeze({ id: fixture.member, session: 'mvp:session', membership: fixture.membership, credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: Object.freeze({ level: 2 }) }),
    membership: Object.freeze({ id: fixture.membership, active: true, accessVersion: 1, denies: Object.freeze([]), grants: Object.freeze([]) }),
    scope: Object.freeze({ kind: 'owner', id: fixture.member, path: Object.freeze([]) }),
    accessVersion: 1,
    capabilities: Object.freeze(['cart.items.put', 'checkout.quote.create', 'order.orders.create']),
    assurance: Object.freeze({ level: 2 }),
    trace: 'mvp:kernel',
  });
}

function request(type, access, body, path, idempotency) {
  return Object.freeze({
    type,
    access,
    input: Object.freeze({
      path: Object.freeze(path),
      query: Object.freeze({}),
      headers: Object.freeze({}),
      body: Object.freeze(body),
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 30_000,
      signal: new AbortController().signal,
      idempotency,
    }),
  });
}

function pglitePool(database, role = 'shopapp') {
  let connected = false;
  const rawQuery = async (text, values) => result(await database.query(text, values));
  const pool = {
    async connect() {
      if (connected) throw new Error('MVP_DATABASE_CONNECTION_OVERLAP');
      connected = true;
      await database.query(`set role ${role}`);
      return {
        async query(text, values) {
          const completed = ['commit', 'rollback'].includes(text.trim().toLowerCase());
          try {
            return await rawQuery(text, values);
          } finally {
            if (completed) {
              await database.query('reset role');
              connected = false;
            }
          }
        },
        release() {
          if (connected) throw new Error('MVP_DATABASE_TRANSACTION_NOT_CLOSED');
        },
      };
    },
    async query(text, values) {
      if (connected) throw new Error('MVP_DATABASE_CONNECTION_OVERLAP');
      await database.query(`set role ${role}`);
      try {
        return await rawQuery(text, values);
      } finally {
        await database.query('reset role');
      }
    },
    workload() {
      return pool;
    },
    async end() {},
  };
  return pool;
}

function result(value) {
  return Object.freeze({ ...value, rowCount: value.affectedRows ?? value.rows.length });
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

async function seed(database) {
  const hash = 'd'.repeat(64);
  await database.exec(`
    insert into organization.organization(id,kind,parent_id,name,timezone,status,version,created_at,updated_at) values
      ('${fixture.tenant}','tenant','organization-platform-root','MVP tenant','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
      ('${fixture.enterprise}','enterprise','${fixture.tenant}','MVP enterprise','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp()),
      ('${fixture.mall}','mall','${fixture.enterprise}','MVP mall','Asia/Shanghai','active',0,clock_timestamp(),clock_timestamp());
    insert into organization.unitclosure(ancestor_id,descendant_id,depth) values
      ('${fixture.tenant}','${fixture.tenant}',0),('${fixture.enterprise}','${fixture.enterprise}',0),('${fixture.mall}','${fixture.mall}',0),
      ('organization-platform-root','${fixture.tenant}',1),('organization-platform-root','${fixture.enterprise}',2),('organization-platform-root','${fixture.mall}',3),
      ('${fixture.tenant}','${fixture.enterprise}',1),('${fixture.tenant}','${fixture.mall}',2),('${fixture.enterprise}','${fixture.mall}',1);
    insert into identity.principal(id,status,credential_version,created_at,updated_at,version)
      values('mvp:principal','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
      values('${fixture.member}','mvp:principal','MVP member','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at)
      values('${fixture.membership}','${fixture.member}','${fixture.mall}','storefront','active',1,clock_timestamp());
    insert into identity.federatedidentity(id,principal_id,membership_id,provider,application_hash,subject_hash,union_hash,subject_ciphertext,
      subject_key_version,status,bound_at,created_at,updated_at)
      values('mvp:wechatidentity','mvp:principal','${fixture.membership}','wechat','${fixture.applicationHash}',repeat('f',64),null,
        'mvp-ciphertext-0123456789','mvp-key-v1','active',clock_timestamp(),clock_timestamp(),clock_timestamp());
    insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
      values('${fixture.member}','${fixture.mall}','310000','上海市','{}','active',1,clock_timestamp());
    insert into catalog.category(id,code,name,status,sort_order) values('${fixture.category}','mvp-milk','乳品','active',1);
    insert into catalog.product(id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values('${fixture.product}','${fixture.category}','纯牛奶','physical','{"subtitle":"MVP kernel product"}','active',1,clock_timestamp(),clock_timestamp());
    insert into catalog.sku(id,product_id,code,specifications,status,version)
      values('${fixture.sku}','${fixture.product}','MVP-MILK-250','{"size":"250ml"}','active',1);
    insert into catalog.pool(id,scope_id,kind,name,status,version) values('${fixture.pool}','${fixture.mall}','private','MVP pool','active',1);
    insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at) values('${fixture.pool}','${fixture.sku}','included','1',clock_timestamp());
    insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
      values('${fixture.mall}','${fixture.pool}','selected','active',clock_timestamp(),clock_timestamp());
    insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,version,created_at,updated_at)
      values('${fixture.listing}','${fixture.mall}','${fixture.pool}','${fixture.sku}','纯牛奶','published',clock_timestamp(),1,clock_timestamp(),clock_timestamp());
    insert into pricing.pricebook(id,scope_id,currency,name,status,version) values('${fixture.pricebook}','${fixture.mall}','CNY','MVP pricebook','active',1);
    insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at)
      values('${fixture.price}','${fixture.pricebook}','${fixture.sku}',2590,2990,'1970-01-01T00:00:00Z');
    insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
      values('${fixture.stock}','${fixture.mall}','${fixture.sku}','mvp:warehouse',100,5,1,'active',clock_timestamp());
    insert into experience.application(id,scope_id,name,status,created_at,updated_at,version,code,public_slug)
      values('${fixture.application}','${fixture.mall}','MVP storefront','active',clock_timestamp(),clock_timestamp(),1,'MVP_APPLICATION','mvp-application');
    insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,created_by,created_at)
      values('${fixture.version}','${fixture.application}',1,'2','{"version":2,"application":"${fixture.application}","pages":[{"id":"home","path":"/","blocks":[]}]}','${hash}','valid','mvp:kernel',clock_timestamp());
    update experience.application set head_version_id='${fixture.version}' where id='${fixture.application}';
    insert into experience.release(id,application_id,version_id,state,effective_at,published_by)
      values('${fixture.release}','${fixture.application}','${fixture.version}','active',clock_timestamp(),'mvp:kernel');
    insert into experience.binding(application_id,domain,mall_id,pool_id) values('${fixture.application}','mvp.invalid','${fixture.mall}','${fixture.pool}');
    insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at)
      values('${fixture.publication}','${fixture.release}','${fixture.application}','${fixture.version}','${hash}',
        'experience/${fixture.application}/${hash}.json','mvp:object','${hash}',1,'active',clock_timestamp(),clock_timestamp());
    insert into checkout.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,status,version,
      recipient_masked,mobile_masked,address_masked,region_code)
      values('${fixture.address}','${fixture.member}','cipher:recipient','cipher:mobile','cipher:address',repeat('a',64),repeat('b',64),'active',1,
        'M**','138****0000','上海市***','310000');
  `);
}
