import { createHash } from 'node:crypto';
import { OperationCatalog, serializeExperience } from '@shop/contract';
import { NETWORK_CATALOG } from '@shop/config/networkcatalog';
import { Singleflight } from '@shop/kernel';
import { WechatPaymentManifest } from '@shop/wechatpayment';
import { Container } from '../../services/commerce/src/composition/Container.ts';
import { AUDIT_SINK } from '../../services/commerce/src/pipeline/AuditSink.ts';
import { DATABASE_POOL } from '../../services/commerce/src/platform/database/Pool.ts';
import { SECURITY_KEYS } from '../../services/commerce/src/platform/secret/SecretStore.ts';
import { KMS_CLIENT } from '../../services/commerce/src/pipeline/KmsPort.ts';
import { RunJob } from '../../services/commerce/src/modules/runtime/application/process/RunJob.ts';
import { jobDefinition } from '../../services/commerce/src/pipeline/JobCatalog.ts';
import { HandlerRegistry } from '../../services/commerce/src/pipeline/HandlerRegistry.ts';
import { OperationExecutor } from '../../services/commerce/src/pipeline/OperationExecutor.ts';
import { AuditDecorator } from '../../services/commerce/src/pipeline/AuditDecorator.ts';
import { OutboxRelay } from '../../services/commerce/src/platform/messaging/OutboxRelay.ts';
import { RuntimeEventPublisher } from '../../services/commerce/src/platform/messaging/RuntimeEventPublisher.ts';
import { EventRegistry } from '../../services/commerce/src/composition/EventRegistry.ts';
import { EVENT_SCHEMA_TYPES } from '../../services/commerce/src/generated/EventCatalog.ts';
import { EVENT_SUBSCRIPTIONS } from '../../services/commerce/src/generated/EventSubscriptions.ts';
import { RecordAudit } from '../../services/commerce/src/modules/audit/application/service/RecordAudit.ts';
import { PgAuditRepository } from '../../services/commerce/src/modules/audit/infrastructure/persistence/PgAuditRepository.ts';
import { PgAuditAppender } from '../../services/commerce/src/modules/audit/infrastructure/persistence/PgAuditAppender.ts';
import { PgMakerCheckerGuard } from '../../services/commerce/src/modules/access/infrastructure/persistence/PgMakerCheckerGuard.ts';
import { PgIdempotencyRepository } from '../../services/commerce/src/platform/database/PgIdempotencyRepository.ts';
import { PgTransactionalOutbox } from '../../services/commerce/src/platform/database/PgTransactionalOutbox.ts';
import { PgTransactionAccess } from '../../services/commerce/src/platform/database/PgTransactionAccess.ts';
import { PgTransactionManager } from '../../services/commerce/src/platform/database/PgTransactionManager.ts';
import { PgJobQueue } from '../../services/commerce/src/modules/runtime/infrastructure/persistence/PgJobQueue.ts';
import { PgDeadletterStore } from '../../services/commerce/src/platform/database/PgDeadletterStore.ts';
import { CartModule } from '../../services/commerce/src/modules/cart/Module.ts';
import { CheckoutModule } from '../../services/commerce/src/modules/checkout/Module.ts';
import { PaymentModule } from '../../services/commerce/src/modules/payment/Module.ts';
import { RecoverPayment } from '../../services/commerce/src/modules/payment/application/process/RecoverPayment.ts';
import { PgPaymentRecoveryProcess } from '../../services/commerce/src/modules/payment/infrastructure/persistence/PgPaymentRecoveryProcess.ts';
import { PaymentRecoveryJob } from '../../services/commerce/src/modules/payment/interface/job/PaymentRecoveryJob.ts';
import { PAYMENT_GATEWAY } from '../../services/commerce/src/modules/payment/application/port/PaymentGateway.ts';
import { ReconcileFinance } from '../../services/commerce/src/modules/finance/application/process/ReconcileFinance.ts';
import { PgReconciliationProcess } from '../../services/commerce/src/modules/finance/infrastructure/persistence/PgReconciliationProcess.ts';
import { ReconciliationJob } from '../../services/commerce/src/modules/finance/interface/job/ReconciliationJob.ts';
import { BenefitPort } from '../../services/commerce/src/modules/benefit/infrastructure/persistence/BenefitPort.ts';
import { VoucherPort } from '../../services/commerce/src/modules/voucher/infrastructure/persistence/VoucherPort.ts';
import { PgAccountingPort } from '../../services/commerce/src/modules/finance/infrastructure/persistence/PgAccountingPort.ts';
import { InventoryPort } from '../../services/commerce/src/modules/inventory/infrastructure/persistence/InventoryPort.ts';
import { PgInventoryReadPort } from '../../services/commerce/src/modules/inventory/infrastructure/persistence/PgInventoryReadPort.ts';
import { PgMarketingReadPort } from '../../services/commerce/src/modules/marketing/infrastructure/persistence/PgMarketingReadPort.ts';
import { PgMarketingReservePort } from '../../services/commerce/src/modules/marketing/infrastructure/persistence/PgMarketingReservePort.ts';
import { FulfillmentPort } from '../../services/commerce/src/modules/fulfillment/infrastructure/persistence/FulfillmentPort.ts';
import { ProcessFulfillmentEvent } from '../../services/commerce/src/modules/fulfillment/application/process/ProcessFulfillmentEvent.ts';
import { PgFulfillmentEventProcess } from '../../services/commerce/src/modules/fulfillment/infrastructure/persistence/PgFulfillmentEventProcess.ts';
import { FulfillmentEventJob } from '../../services/commerce/src/modules/fulfillment/interface/job/FulfillmentEventJob.ts';
import { OrderPort } from '../../services/commerce/src/modules/order/infrastructure/persistence/OrderPort.ts';
import { PgOrderReadPort } from '../../services/commerce/src/modules/order/infrastructure/persistence/PgOrderReadPort.ts';
import { ProcessOrderEvent } from '../../services/commerce/src/modules/order/application/process/ProcessOrderEvent.ts';
import { PgOrderEventProcess } from '../../services/commerce/src/modules/order/infrastructure/persistence/PgOrderEventProcess.ts';
import { OrderEventJob } from '../../services/commerce/src/modules/order/interface/job/OrderEventJob.ts';
import { ChannelOperationPort } from '../../services/commerce/src/modules/channel/infrastructure/persistence/ChannelOperationPort.ts';
import { PgFinanceChannelPort } from '../../services/commerce/src/modules/channel/infrastructure/persistence/PgFinanceChannelPort.ts';
import { PaymentHoldReleaser, PaymentSettlement } from '../../services/commerce/src/modules/payment/infrastructure/persistence/PaymentSettlement.ts';
import { RefundSettlement } from '../../services/commerce/src/modules/payment/infrastructure/persistence/RefundSettlement.ts';
import { CART_PRICING_PORT, CHECKOUT_PRICING_PORT } from '../../services/commerce/src/modules/pricing/public/index.ts';
import { PricingPort } from '../../services/commerce/src/modules/pricing/infrastructure/persistence/PricingPort.ts';
import { CHECKOUT_BENEFIT_PORT, PAYMENT_BENEFIT_PORT } from '../../services/commerce/src/modules/benefit/public/index.ts';
import { CHECKOUT_VOUCHER_PORT, PAYMENT_VOUCHER_PORT } from '../../services/commerce/src/modules/voucher/public/index.ts';
import { CHECKOUT_INVENTORY_PORT, PAYMENT_INVENTORY_PORT } from '../../services/commerce/src/modules/inventory/public/index.ts';
import { INVENTORY_READ_PORT } from '../../services/commerce/src/modules/inventory/public/InventoryReadPort.ts';
import { MARKETING_READ_PORT, MARKETING_RESERVE_PORT } from '../../services/commerce/src/modules/marketing/public/index.ts';
import { CART_READ_PORT, CHECKOUT_CART_PORT } from '../../services/commerce/src/modules/cart/public/index.ts';
import { CART_CATALOG_PORT, CHECKOUT_CATALOG_PORT } from '../../services/commerce/src/modules/catalog/public/index.ts';
import { PgCatalogFacade } from '../../services/commerce/src/modules/catalog/infrastructure/persistence/PgCatalogFacade.ts';
import { CART_EXPERIENCE_PORT, CHECKOUT_EXPERIENCE_PORT } from '../../services/commerce/src/modules/experience/public/index.ts';
import { PgCartExperiencePort } from '../../services/commerce/src/modules/experience/infrastructure/persistence/PgCartExperiencePort.ts';
import { PgCheckoutExperiencePort } from '../../services/commerce/src/modules/experience/infrastructure/persistence/PgCheckoutExperiencePort.ts';
import { EXPERIENCE_READ_PORT } from '../../services/commerce/src/modules/experience/public/ExperienceReadPort.ts';
import { EntryResolver } from '../../services/commerce/src/modules/experience/application/service/EntryResolver.ts';
import { PgEntryRepository } from '../../services/commerce/src/modules/experience/infrastructure/persistence/PgEntryRepository.ts';
import { PgExperienceReadPort } from '../../services/commerce/src/modules/experience/infrastructure/persistence/PgExperienceReadPort.ts';
import { MEMBER_ACCESS_PORT } from '../../services/commerce/src/modules/access/public/index.ts';
import { AccessPort } from '../../services/commerce/src/modules/access/application/service/AccessPort.ts';
import { PgAccessRepository } from '../../services/commerce/src/modules/access/infrastructure/persistence/PgAccessRepository.ts';
import { AccessVersionPublisher } from '../../services/commerce/src/modules/access/application/service/AccessVersionPublisher.ts';
import { CHECKOUT_QUALIFICATION_PORT } from '../../services/commerce/src/modules/qualification/public/index.ts';
import { PgCheckoutQualificationPort } from '../../services/commerce/src/modules/qualification/infrastructure/persistence/PgCheckoutQualificationPort.ts';
import { RISK_DECISION_PORT } from '../../services/commerce/src/modules/risk/public/index.ts';
import { EvaluateRiskDecision } from '../../services/commerce/src/modules/risk/infrastructure/persistence/EvaluateRiskDecision.ts';
import { ORGANIZATION_READ_PORT } from '../../services/commerce/src/modules/organization/public/index.ts';
import { PgOrganizationReadPort } from '../../services/commerce/src/modules/organization/infrastructure/persistence/PgOrganizationReadPort.ts';
import { ORDER_INTENT_PORT, ORDER_PAYMENT_PORT, ORDER_READ_PORT } from '../../services/commerce/src/modules/order/public/index.ts';
import { CHECKOUT_PAYMENT_PORT } from '../../services/commerce/src/modules/payment/public/index.ts';
import { PaymentPort } from '../../services/commerce/src/modules/payment/infrastructure/persistence/PaymentPort.ts';
import { CHECKOUT_INVOICE_PORT } from '../../services/commerce/src/modules/finance/public/index.ts';
import { InvoicePort } from '../../services/commerce/src/modules/finance/application/service/InvoicePort.ts';
import { PAYMENT_IDENTITY_PORT } from '../../services/commerce/src/modules/identity/public/index.ts';
import { PgPaymentIdentityPort } from '../../services/commerce/src/modules/identity/infrastructure/persistence/PgPaymentIdentityPort.ts';
import { MEMBER_ADDRESS_PORT } from '../../services/commerce/src/modules/member/public/index.ts';
import { PgAddressRepository } from '../../services/commerce/src/modules/member/infrastructure/persistence/PgAddressRepository.ts';

const fixture = Object.freeze({
  tenant: 'mvp:tenant',
  enterprise: 'mvp:enterprise',
  mall: 'mvp:mall',
  member: 'mvp:member',
  principal: 'mvp:principal',
  membership: 'mvp:membership',
  application: 'mvp:application',
  version: 'mvp:experienceversion',
  release: 'mvp:release',
  publication: 'mvp:publication',
  category: 'mvp:category',
  product: 'mvp:product',
  sku: 'sku:mvp',
  pool: 'mvp:pool',
  listing: 'mvp:listing',
  pricebook: 'pricebook:mvp',
  price: 'price:mvp',
  stock: 'stock:mvp',
  address: 'mvp:address',
  applicationHash: 'e'.repeat(64),
  payer: 'openid:mvp-kernel',
});
const experienceDocument = Object.freeze({
  version: 2,
  application: fixture.application,
  theme: Object.freeze({ preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null }),
  navigation: Object.freeze([{ id: `${fixture.application}:navigation:home`, label: '首页', page: 'home' }]),
  assets: Object.freeze([]),
  pages: Object.freeze([{ id: 'home', path: '/', blocks: Object.freeze([]) }]),
});
const experienceConfiguration = serializeExperience(experienceDocument);
const experienceHash = createHash('sha256').update(experienceConfiguration).digest('hex');

export async function verifyMvpKernel(database) {
  await seed(database);
  await verifyStorefrontEntry(database);
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
  const finance = new PgAccountingPort();
  const checkoutBenefitPort = new BenefitPort();
  const paymentBenefitPort = new BenefitPort(finance);
  const checkoutVoucherPort = new VoucherPort();
  const paymentVoucherPort = new VoucherPort(finance);
  const pricingPort = new PricingPort();
  const inventoryPort = new InventoryPort();
  const marketingReadPort = new PgMarketingReadPort();
  const marketingReservePort = new PgMarketingReservePort();
  const orderPort = new OrderPort();
  const catalogPort = new PgCatalogFacade(pool);
  const cache = authoritativeCache();
  const experienceReadPort = new PgExperienceReadPort(
    new EntryResolver(
      new PgEntryRepository({ origin: NETWORK_CATALOG.origins.storefront, entryPath: NETWORK_CATALOG.storefront.entryPath }),
      authoritativeEntryCache(),
      new Singleflight(),
      { resolve: () => undefined, states: () => undefined, publication: () => undefined }
    ),
    cache,
    new PgTransactionAccess()
  );
  const transactionAccess = new PgTransactionAccess();
  const accessRepository = new PgAccessRepository();
  const memberAccessPort = new AccessPort(accessRepository, new AccessVersionPublisher(accessRepository));
  const invoicePort = new InvoicePort();
  container.bind(KMS_CLIENT, Object.freeze({ decrypt: async () => fixture.payer }));
  container.bind(PAYMENT_GATEWAY, gateway);
  const ports = new Map([
    [MEMBER_ACCESS_PORT.key, memberAccessPort],
    [CART_CATALOG_PORT.key, catalogPort],
    [CHECKOUT_CATALOG_PORT.key, catalogPort],
    [CART_EXPERIENCE_PORT.key, new PgCartExperiencePort()],
    [CHECKOUT_EXPERIENCE_PORT.key, new PgCheckoutExperiencePort()],
    [EXPERIENCE_READ_PORT.key, experienceReadPort],
    [CART_PRICING_PORT.key, pricingPort],
    [CHECKOUT_PRICING_PORT.key, pricingPort],
    [CHECKOUT_BENEFIT_PORT.key, checkoutBenefitPort],
    [CHECKOUT_VOUCHER_PORT.key, checkoutVoucherPort],
    [CHECKOUT_INVENTORY_PORT.key, inventoryPort],
    [INVENTORY_READ_PORT.key, new PgInventoryReadPort()],
    [MARKETING_READ_PORT.key, marketingReadPort],
    [MARKETING_RESERVE_PORT.key, marketingReservePort],
    [ORDER_INTENT_PORT.key, orderPort],
    [CHECKOUT_INVOICE_PORT.key, invoicePort],
    [CHECKOUT_QUALIFICATION_PORT.key, new PgCheckoutQualificationPort()],
    [RISK_DECISION_PORT.key, new EvaluateRiskDecision()],
    [ORGANIZATION_READ_PORT.key, new PgOrganizationReadPort()],
    [PAYMENT_BENEFIT_PORT.key, paymentBenefitPort],
    [PAYMENT_VOUCHER_PORT.key, paymentVoucherPort],
    [PAYMENT_INVENTORY_PORT.key, inventoryPort],
    [ORDER_PAYMENT_PORT.key, orderPort],
    [ORDER_READ_PORT.key, new PgOrderReadPort(new PgTransactionManager(pool))],
    [PAYMENT_IDENTITY_PORT.key, new PgPaymentIdentityPort()],
    [MEMBER_ADDRESS_PORT.key, new PgAddressRepository(transactionAccess)],
  ]);
  const handlers = new HandlerRegistry();
  const context = Object.freeze({
    workload: 'api',
    service: (token) => container.get(token),
    ports: Object.freeze({
      get: (token) => {
        const value = ports.get(token.key);
        if (!value) throw new Error(`MVP_PUBLIC_PORT_UNBOUND:${token.key}`);
        return value;
      },
    }),
    handlers,
    events: Object.freeze({ add: () => undefined }),
  });
  for (const module of [CartModule, PaymentModule]) {
    for (const binding of module.bind(context)) ports.set(binding.token.key, binding.value);
  }
  for (const module of [CartModule, CheckoutModule, PaymentModule]) await module.register(context);
  handlers.freeze(
    OperationCatalog.all()
      .filter(({ module }) => ['cart', 'checkout', 'payment'].includes(module))
      .map(({ id }) => id)
  );
  const operations = new OperationExecutor(
    new PgTransactionManager(pool),
    new PgIdempotencyRepository(transactionAccess),
    new PgMakerCheckerGuard(transactionAccess),
    new AuditDecorator(new PgAuditAppender(transactionAccess)),
    new PgTransactionalOutbox(transactionAccess)
  );
  const access = accessContext();

  const cart = await invoke(handlers, operations, request('cart.items.put', access, { quantity: 2, lineVersion: null }, { listingid: fixture.listing }, 'mvp-cart-put', 0));
  assert(cart.status === 200, `MVP_CART_WRITE_FAILED:${cart.status}`);
  const quote = await invoke(
    handlers,
    operations,
    request(
      'checkout.quote.create',
      access,
      {
        cartVersion: 1,
        lines: [{ listingId: fixture.listing, quantity: 2, lineVersion: 0 }],
        addressId: fixture.address,
        invoiceId: null,
        delivery: { method: 'express' },
        voucherIds: [],
        benefits: [],
        paymentScene: 'jsapi',
      },
      {},
      'mvp-quote-create'
    )
  );
  const quoteid = quote.body?.quoteId;
  const confirmationToken = quote.body?.confirmationToken;
  assert(quote.status === 201 && typeof quoteid === 'string' && typeof confirmationToken === 'string', `MVP_QUOTE_FAILED:${quote.status}`);
  const order = await invoke(
    handlers,
    operations,
    request('order.orders.create', access, { quoteId: quoteid, confirmationToken, paymentScene: 'jsapi' }, {}, 'mvp-order-create')
  );
  const orderid = order.body?.order?.id;
  assert(order.status === 201 && typeof orderid === 'string', `MVP_ORDER_FAILED:${order.status}`);
  assert(order.body?.payment?.state === 'pending' && order.body.payment.action?.package === 'prepay_id=mvp-kernel', `MVP_PAYMENT_PREPARATION_FAILED:${String(order.body?.payment?.state)}`);

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
    (select count(*)::integer from inventory.reservation where owner_id=$4 and state='reserved') reservations,
    (select state from payment.intent where order_id=$4) intent_state,
    (select amount_minor::float8 from payment.intent where order_id=$4) intent_minor,
    (select tender.state from payment.intenttender tender join payment.intent intent on intent.id=tender.intent_id where intent.order_id=$4 and tender.kind='wechat') tender_state,
    (select count(*)::integer from runtime.outbox where aggregate_id in($4,(select id from checkout.session where quote_id=$3))) outbox_events,
    (select count(*)::integer from audit.record where actor_id=$5 and operation in('cart.items.put','checkout.quote.create','order.orders.create')) audits,
    (select count(*)::integer from runtime.idempotency where actor_id=$5 and state='completed') idempotency_records`,
    [fixture.member, fixture.mall, quoteid, orderid, fixture.principal]
  );
  const row = evidence.rows[0];
  const expected = {
    cart_state: 'converted',
    checkout_state: 'confirmed',
    payment_state: 'authorizing',
    order_state: 'awaitingpayment',
    total_minor: 5180,
    lines: 1,
    reservations: 1,
    intent_state: 'pending',
    intent_minor: 5180,
    tender_state: 'planned',
    outbox_events: 4,
    audits: 3,
    idempotency_records: 3,
  };
  for (const [field, value] of Object.entries(expected)) assert(row?.[field] === value, `MVP_KERNEL_EVIDENCE_INVALID:${field}:${String(row?.[field])}`);
  console.log(`smart-wing MVP kernel passed: cart=converted quote=confirmed order=awaitingpayment payment=authorizing totalMinor=${row.total_minor} outbox=${row.outbox_events} audits=${row.audits}`);
  await verifyPayment(database, handlers, operations, gateway, orderid);
}

async function verifyStorefrontEntry(database) {
  const rows = (
    await database.query(
      `select application,handle,mall,pool,release,version,tenant,application_status,validation_state,
      publication_state,content_hash,configuration_hash,object_key
      from experience.resolve_storefront_entry($1)`,
      ['mvp-application']
    )
  ).rows;
  assert(rows.length === 1, `MVP_STOREFRONT_ENTRY_COUNT_INVALID:${rows.length}`);
  const entry = rows[0];
  const expected = {
    application: fixture.application,
    handle: 'mvp-application',
    mall: fixture.mall,
    pool: fixture.pool,
    release: fixture.release,
    version: fixture.version,
    tenant: fixture.tenant,
    application_status: 'active',
    validation_state: 'valid',
    publication_state: 'active',
    content_hash: experienceHash,
    configuration_hash: experienceHash,
    object_key: `experience/${fixture.application}/${experienceHash}.json`,
  };
  for (const [field, value] of Object.entries(expected)) assert(entry?.[field] === value, `MVP_STOREFRONT_ENTRY_INVALID:${field}:${String(entry?.[field])}`);
  const missing = await database.query(`select application from experience.resolve_storefront_entry($1)`, ['missing-mall']);
  assert(missing.rows.length === 0, `MVP_STOREFRONT_UNKNOWN_ENTRY_VISIBLE:${missing.rows.length}`);
}

async function verifyPayment(database, handlers, operations, gateway, order) {
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
  const webhook = await invoke(handlers, operations, webhookRequest());
  assert(webhook.status === 204, `MVP_PAYMENT_WEBHOOK_FAILED:${webhook.status}`);
  const replay = await invoke(handlers, operations, webhookRequest());
  assert(replay.status === 204, `MVP_PAYMENT_WEBHOOK_REPLAY_FAILED:${replay.status}`);

  const jobPool = pglitePool(database, 'shopjob');
  const paymentProcessor = new PaymentRecoveryJob('paymentquery', new RecoverPayment(new PgPaymentRecoveryProcess(new PgTransactionManager(jobPool), gateway, paymentJobDependencies())));
  await runOneJob(jobPool, 'paymentquery', 'mvp:payment', paymentProcessor);
  await relayAvailableEvents(jobPool);
  await runOneJob(jobPool, 'orderevent', 'mvp:order', new OrderEventJob(new ProcessOrderEvent(new PgOrderEventProcess(new PgTransactionManager(jobPool)))));
  await relayAvailableEvents(jobPool);
  await runOneJob(
    jobPool,
    'fulfillmentevent',
    'mvp:fulfillment',
    new FulfillmentEventJob(new ProcessFulfillmentEvent(new PgFulfillmentEventProcess(new PgTransactionManager(jobPool), new OrderPort())))
  );
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
    (select count(*)::integer from runtime.jobs where kind='paymentquery' and state='succeeded') completed_payment_jobs,
    (select count(*)::integer from runtime.inbox where consumer='job:reconciliation' and event_type='payment.captured' and processed_at is not null) finance_inbox,
    (select count(*)::integer from runtime.jobs where kind='reconciliation' and state='succeeded') completed_finance_jobs,
    (select count(*)::integer from finance.journal journal join payment.payment payment on payment.id=journal.reference_id
      join payment.intent intent on intent.id=payment.intent_id where intent.order_id=$1 and journal.reference_type='payment.captured') journals,
    (select count(*)::integer from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
      join payment.payment payment on payment.id=journal.reference_id join payment.intent intent on intent.id=payment.intent_id
      where intent.order_id=$1 and journal.reference_type='payment.captured') entries,
    (select coalesce(sum(case entry.side when 'debit' then entry.amount_minor else -entry.amount_minor end),0)::float8
      from finance.entry entry join finance.journal journal on journal.id=entry.journal_id
      join payment.payment payment on payment.id=journal.reference_id join payment.intent intent on intent.id=payment.intent_id
      where intent.order_id=$1 and journal.reference_type='payment.captured') balance,
    (select count(*)::integer from runtime.outbox event where event.event_type='finance.entry.posted' and event.published_at is not null
      and event.payload->>'referenceId'=(select payment.id from payment.payment payment join payment.intent intent on intent.id=payment.intent_id
        where intent.order_id=$1)) finance_events,
    (select count(*)::integer from audit.record where actor_id='provider:wechat' and operation='payment.webhooks.wechat') payment_audits`,
      [order]
    )
  ).rows[0];
  const expected = {
    payment_state: 'paid',
    lifecycle_state: 'paid',
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
    completed_finance_jobs: 1,
    journals: 1,
    entries: 2,
    balance: 0,
    finance_events: 1,
    payment_audits: 2,
  };
  for (const [field, value] of Object.entries(expected)) assert(result?.[field] === value, `MVP_PAYMENT_EVIDENCE_INVALID:${field}:${String(result?.[field])}`);
  console.log(`smart-wing payment kernel passed: intent=captured order=paid inventory=committed fulfillment=${result.fulfillments} webhookInbox=${result.provider_inbox}`);
  console.log(`smart-wing finance kernel passed: journal=${result.journals} entries=${result.entries} balance=${result.balance} financeInbox=${result.finance_inbox}`);
}

function paymentJobDependencies() {
  const finance = new PgAccountingPort();
  const benefit = new BenefitPort(finance);
  const voucher = new VoucherPort(finance);
  const orders = new OrderPort();
  const inventory = new InventoryPort();
  const marketing = new PgMarketingReservePort();
  return Object.freeze({
    settlement: new PaymentSettlement(benefit, voucher, inventory, marketing, orders),
    refundSettlement: new RefundSettlement(benefit, voucher, orders, new PgOrganizationReadPort()),
    orders,
    operations: new ChannelOperationPort(),
    holds: new PaymentHoldReleaser(benefit, voucher, inventory, marketing),
  });
}

async function relayAvailableEvents(jobPool) {
  const relay = new OutboxRelay(jobPool, new RuntimeEventPublisher(jobPool, eventRegistry()), 'mvp:relay', 1);
  const signal = new AbortController().signal;
  for (let index = 0; index < 2_048; index += 1) {
    if ((await relay.relay(1, signal, Date.now() + 30_000)) === 0) return;
  }
  throw new Error('MVP_OUTBOX_RELAY_DID_NOT_DRAIN');
}

function eventRegistry() {
  const registry = new EventRegistry();
  for (const event of EVENT_SCHEMA_TYPES) registry.declare(event);
  for (const [subscriber, events] of Object.entries(EVENT_SUBSCRIPTIONS)) {
    for (const event of events) registry.subscribe(event, subscriber);
  }
  registry.freeze();
  return registry;
}

async function runReconciliation(database, jobPool) {
  const queued = (await database.query("select count(*)::integer count from runtime.jobs where kind='reconciliation' and state='queued'")).rows[0]?.count;
  if (queued !== 1) {
    const [events, jobs, intents] = await Promise.all([
      database.query(
        `select event_type,published_at,error_code,failed_at,available_at,attempts from runtime.outbox
        where event_type in('payment.captured','order.paid') order by occurred_at,id`
      ),
      database.query("select kind,state,attempts,payload from runtime.jobs where kind in('paymentquery','reconciliation') order by kind,id"),
      database.query('select intent.state,(select count(*) from payment.payment where intent_id=intent.id)::integer payments from payment.intent intent order by intent.id'),
    ]);
    throw new Error(`MVP_FINANCE_JOB_INVALID:${String(queued)}:${JSON.stringify({ events: events.rows, jobs: jobs.rows, intents: intents.rows })}`);
  }
  const processor = new ReconciliationJob(
    new ReconcileFinance(
      new PgReconciliationProcess(new PgTransactionManager(jobPool), unavailableObjects(), {
        channel: new PgFinanceChannelPort(),
        payments: new PaymentPort(),
        fulfillments: new FulfillmentPort(new OrderPort()),
      })
    )
  );
  await runOneJob(jobPool, 'reconciliation', 'mvp:finance', processor);
}

async function runOneJob(jobPool, kind, worker, processor) {
  const controller = new AbortController();
  const definition = jobDefinition(kind);
  let processorFailure;
  const guarded = Object.freeze({
    async process(job, signal) {
      try {
        await processor.process(job, signal);
      } catch (cause) {
        processorFailure = cause;
        throw cause;
      }
    },
  });
  const runner = new RunJob(new PgTransactionManager(jobPool), singleJobRepository(controller), new PgDeadletterStore(), {
    worker,
    workload: 'jobs',
    owner: definition.owner,
    queue: definition.queue,
    batch: 1,
    lease: definition.lease,
    concurrency: 1,
    attempts: definition.retry.attempts,
    poll: 1,
    deadline: definition.timeout,
    retryMinimum: definition.retry.minimum,
    retryMaximum: definition.retry.maximum,
  }, Object.freeze({ assert: async () => { throw new Error('MVP_USER_AUTHORIZATION_UNEXPECTED'); } }));
  await runner.execute(kind, guarded, controller.signal);
  if (processorFailure) throw processorFailure;
}

function singleJobRepository(controller) {
  const jobs = new PgJobQueue();
  return Object.freeze({
    claim: (context, request) => jobs.claim(context, request),
    heartbeat: (context, job, worker, lease) => jobs.heartbeat(context, job, worker, lease),
    async complete(context, job, worker) {
      try {
        await jobs.complete(context, job, worker);
      } finally {
        controller.abort();
      }
    },
    async fail(context, job, worker, terminal, delay, error) {
      try {
        await jobs.fail(context, job, worker, terminal, delay, error);
      } finally {
        controller.abort();
      }
    },
  });
}

function unavailableObjects() {
  const unavailable = async () => {
    throw new Error('MVP_OBJECT_STORE_NOT_AVAILABLE');
  };
  return Object.freeze({ create: unavailable, find: unavailable, read: unavailable, inspect: unavailable, authorize: unavailable });
}

function paymentBoundary() {
  const boundary = {
    manifest: WechatPaymentManifest,
    application(scene) {
      return Object.freeze({ scene, applicationHash: fixture.applicationHash });
    },
    async prepay(input) {
      boundary.providerReference = input.orderNumber;
      return Object.freeze({ providerRequestId: 'mvp:prepay', timeStamp: '1', nonceStr: 'mvp', package: 'prepay_id=mvp-kernel', signType: 'RSA', paySign: 'mvp-signature' });
    },
    async query(orderNumber, application) {
      assert(orderNumber === boundary.providerReference && application.applicationHash === fixture.applicationHash, 'MVP_PAYMENT_QUERY_CONTEXT_INVALID');
      return Object.freeze({ state: 'succeeded', transaction: 'mvp:wechat-transaction', amountMinor: 5180 });
    },
    async close() {},
    async refund() {
      return Object.freeze({ state: 'succeeded', reference: 'mvp:refund' });
    },
    async queryRefund() {
      return Object.freeze({ state: 'succeeded', reference: 'mvp:refund' });
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
        occurredAt: new Date().toISOString(),
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
    security: Object.freeze({ kind: 'anonymous', channel: 'webhook', target: null, trace: 'mvp:wechat-request' }),
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
    actor: Object.freeze({ id: fixture.principal, session: 'mvp:session', membership: fixture.membership, credentialVersion: 1, accessVersion: 1, target: 'storefront', assurance: Object.freeze({ level: 2 }) }),
    membership: Object.freeze({
      id: fixture.membership,
      active: true,
      accessVersion: 1,
      permissions: Object.freeze({ allows: new Set(), denies: new Set() }),
      scopes: Object.freeze([]),
    }),
    roles: Object.freeze([]),
    organization: fixture.mall,
    scope: Object.freeze({ kind: 'mall', id: fixture.mall, tenant: fixture.tenant, path: Object.freeze([]) }),
    accessVersion: 1,
    capabilities: new Set(['cart.items.put', 'checkout.quote.create', 'order.orders.create']),
    capabilityVersion: 1,
    assurance: Object.freeze({ level: 2 }),
    trace: 'mvp:kernel',
  });
}

function request(type, access, body, path, idempotency, expectedVersion) {
  return Object.freeze({
    type,
    security: Object.freeze({ kind: 'session', access }),
    input: Object.freeze({
      path: Object.freeze(path),
      query: Object.freeze({}),
      headers: Object.freeze({}),
      body: Object.freeze(body),
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 30_000,
      signal: new AbortController().signal,
      idempotency,
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    }),
  });
}

function invoke(handlers, operations, request) {
  const input = Object.freeze({
    ...(Object.keys(request.input.path).length === 0 ? {} : { path: request.input.path }),
    ...(Object.keys(request.input.query).length === 0 ? {} : { query: request.input.query }),
    ...(request.input.body === undefined ? {} : { body: request.input.body }),
  });
  const trace = request.security.kind === 'session' ? request.security.access.trace : request.security.trace;
  return operations.execute(handlers.get(request.type), input, {
    requestId: request.input.headers['request-id'] ?? trace,
    traceId: trace,
    deadline: request.input.deadline,
    signal: request.input.signal,
    operation: request.type,
    security: request.security,
    headers: request.input.headers,
    rawBody: request.input.rawBody,
    ...(request.security.kind === 'anonymous' ? { publicActor: 'provider:wechat' } : {}),
    ...(request.input.idempotency === undefined ? {} : { idempotencyKey: request.input.idempotency }),
    ...(request.input.expectedVersion === undefined ? {} : { expectedVersion: request.input.expectedVersion }),
  });
}

function authoritativeCache() {
  return Object.freeze({
    start: async () => undefined,
    get: async () => null,
    put: async () => true,
    setnx: async () => true,
    compareDelete: async () => true,
    remove: async () => true,
    state: () => Object.freeze({ available: false, reason: 'MVP_DATABASE_AUTHORITY' }),
    close: async () => undefined,
  });
}

function authoritativeEntryCache() {
  return Object.freeze({ read: async () => null, write: async () => undefined, remove: async () => undefined });
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
      values('${fixture.principal}','active',1,clock_timestamp(),clock_timestamp(),0);
    insert into member.profile(id,principal_id,display_name,status,created_at,updated_at,version)
      values('${fixture.member}','${fixture.principal}','MVP member','active',clock_timestamp(),clock_timestamp(),0);
    insert into access.membership(id,member_id,organization_id,client,status,access_version,joined_at,principal_id)
      values('${fixture.membership}','${fixture.member}','${fixture.mall}','storefront','active',1,clock_timestamp(),'${fixture.principal}');
    insert into identity.provider(id,tenant_id,type,provider_tenant_hash,client_id_hash,secret_ref,redirect_uri,scopes,status,version)
      values('11111111-1111-4111-8111-111111111111','00000000-0000-0000-0000-000000000000','wechat',decode(repeat('a',64),'hex'),
        decode('${fixture.applicationHash}','hex'),'identity/mvp/wechat','${NETWORK_CATALOG.origins.auth}/api/v1/identity/federations/callback',
        array['snsapi_base'],'enabled',0);
    insert into identity.federatedidentity(id,principal_id,membership_id,provider,subject_ciphertext,subject_key_version,status,bound_at,revoked_at,
      created_at,updated_at,provider_instance_id,provider_tenant_hash,normalized_subject_hash,linked_at,verified_at,last_seen_at,source,version)
      values('mvp:wechatidentity','${fixture.principal}','${fixture.membership}','wechat','mvp-ciphertext-0123456789','mvp-key-v1','active',
        clock_timestamp(),null,clock_timestamp(),clock_timestamp(),'11111111-1111-4111-8111-111111111111',decode(repeat('a',64),'hex'),
        decode(repeat('f',64),'hex'),clock_timestamp(),clock_timestamp(),clock_timestamp(),'manual',0);
    insert into qualification.profile(member_id,scope_id,city_code,city_name,attributes,status,version,updated_at)
      values('${fixture.member}','${fixture.mall}','310000','上海市','{}','active',1,clock_timestamp());
    insert into catalog.category(id,code,name,status,sort_order) values('${fixture.category}','mvp-milk','乳品','active',1);
    insert into catalog.product(id,scope_id,category_id,title,product_type,attributes,status,version,created_at,updated_at)
      values('${fixture.product}','${fixture.mall}','${fixture.category}','纯牛奶','physical','{"subtitle":"MVP kernel product"}','active',1,clock_timestamp(),clock_timestamp());
    insert into catalog.sku(id,scope_id,product_id,code,specifications,status,version)
      values('${fixture.sku}','${fixture.mall}','${fixture.product}','MVP-MILK-250','{"size":"250ml"}','active',1);
    insert into catalog.pool(id,scope_id,kind,name,status,version) values('${fixture.pool}','${fixture.mall}','private','MVP pool','active',1);
    insert into catalog.poolitem(pool_id,sku_id,state,source_version,added_at) values('${fixture.pool}','${fixture.sku}','included','1',clock_timestamp());
    insert into catalog.poolbinding(mall_id,pool_id,listing_kind,status,effective_at,created_at)
      values('${fixture.mall}','${fixture.pool}','selected','active',clock_timestamp(),clock_timestamp());
    insert into pricing.pricebook(id,scope_id,currency,name,status,version) values('${fixture.pricebook}','${fixture.mall}','CNY','MVP pricebook','active',1);
    insert into pricing.price(id,book_id,sku_id,amount_minor,compare_minor,effective_at)
      values('${fixture.price}','${fixture.pricebook}','${fixture.sku}',2590,2990,'1970-01-01T00:00:00Z');
    insert into inventory.stockitem(id,scope_id,sku_id,location_id,onhand,safety,version,status,updated_at)
      values('${fixture.stock}','${fixture.mall}','${fixture.sku}','mvp:warehouse',100,5,1,'active',clock_timestamp());
    insert into catalog.listing(id,scope_id,pool_id,sku_id,title,status,effective_at,version,created_at,updated_at)
      values('${fixture.listing}','${fixture.mall}','${fixture.pool}','${fixture.sku}','纯牛奶','published',clock_timestamp(),1,clock_timestamp(),clock_timestamp());
    insert into experience.application(id,mall_id,name,status,created_at,updated_at,version,code,public_slug)
      values('${fixture.application}','${fixture.mall}','MVP storefront','active',clock_timestamp(),clock_timestamp(),1,'MVP_APPLICATION','mvp-application');
    insert into experience.version(id,application_id,sequence,schema_version,configuration,configuration_hash,validation_state,
      validation_issues,publish_evidence,frozen_at,created_by,created_at)
      values('${fixture.version}','${fixture.application}',1,'2',$experience$${experienceConfiguration}$experience$::jsonb,'${experienceHash}','valid',
        '[]'::jsonb,'{"dependencies":{},"issues":[]}'::jsonb,clock_timestamp(),'mvp:kernel',clock_timestamp());
    update experience.application set head_version_id='${fixture.version}',version=version+1,updated_at=clock_timestamp() where id='${fixture.application}';
    insert into experience.release(id,application_id,version_id,pool_id,state,effective_at,published_by)
      values('${fixture.release}','${fixture.application}','${fixture.version}','${fixture.pool}','scheduled',clock_timestamp(),'mvp:kernel');
    insert into experience.publication(id,release_id,application_id,version_id,content_hash,object_key,object_ref,object_hash,object_size,state,staged_at,published_at)
      values('${fixture.publication}','${fixture.release}','${fixture.application}','${fixture.version}','${experienceHash}',
        'experience/${fixture.application}/${experienceHash}.json','mvp:object','${experienceHash}',1,'active',clock_timestamp(),clock_timestamp());
    update experience.release set state='active' where id='${fixture.release}';
    insert into member.address(id,member_id,recipient_ciphertext,mobile_ciphertext,address_ciphertext,region_token,address_token,status,version,is_default,
      recipient_masked,mobile_masked,address_masked,region_code)
      values('${fixture.address}','${fixture.member}','cipher:recipient','cipher:mobile','cipher:address',repeat('a',64),repeat('b',64),'active',1,true,
        'M**','138****0000','上海市***','310000');
  `);
}
