import { describe, expect, it } from 'vitest';
import { COMMERCE_EVENTS, errorDefinition, errorStatus, EVENT_PAYLOAD_SCHEMAS, EXPERIENCE_COMPONENTS, OPERATION_SCHEMAS, OperationCatalog, parseEventPayload, parseExperience, serializeEvent, serializeExperience } from './index';
import { definedOperationBodySchema, definedOperationOutputSchema, definedOperationQuerySchema } from './schema';

describe('contract truth', () => {
  it('keeps operation identifiers and routes unique', () => {
    const operations = OperationCatalog.all();
    expect(new Set(operations.map((item) => item.id)).size).toBe(operations.length);
    expect(new Set(operations.map((item) => `${item.method} ${item.path}`)).size).toBe(operations.length);
  });

  it('publishes one runtime schema pair for every Operation', () => {
    const operationIds = OperationCatalog.all()
      .map(({ id }) => id)
      .sort();
    expect(Object.keys(OPERATION_SCHEMAS).sort()).toEqual(operationIds);
    expect(Object.values(OPERATION_SCHEMAS).every(({ input, output }) => input !== output)).toBe(true);
  });

  it('validates path parameters and rejects undeclared input fields', () => {
    const schema = OPERATION_SCHEMAS['catalog.products.update'].input;
    expect(schema.parse({ path: { productid: 'product:1' }, body: { title: 'new' } })).toEqual({
      path: { productid: 'product:1' },
      body: { title: 'new' },
    });
    expect(() => schema.parse({ body: {} })).toThrow();
    expect(() => schema.parse({ path: { productid: 'product:1', wrong: 'value' }, body: {} })).toThrow();
  });

  it('keeps invitation resolution separate from sign-in and binds personal enrollment challenges server-side', () => {
    const sessionSchema = OPERATION_SCHEMAS['identity.sessions.create'].input;
    const authorization = { state: 'state', nonce: 'nonce', challenge: 'a'.repeat(43) };
    expect(() => sessionSchema.parse({ body: { method: 'invitation', code: 'invite', target: 'console', returnTarget: 'signed-target', authorization } })).toThrow();
    expect(OPERATION_SCHEMAS['identity.invitations.resolve'].input.parse({ body: { code: 'invite', target: 'storefront', returnTarget: 'signed-target', authorization } })).toEqual({
      body: { code: 'invite', target: 'storefront', returnTarget: 'signed-target', authorization },
    });
    expect(OPERATION_SCHEMAS['identity.challenges.create'].input.parse({ body: { purpose: 'enrollment', enrollmentId: 'enrollment:one' } })).toEqual({ body: { purpose: 'enrollment', enrollmentId: 'enrollment:one' } });
    expect(() => OPERATION_SCHEMAS['identity.challenges.create'].input.parse({ body: { purpose: 'enrollment', enrollmentId: 'enrollment:one', destination: '13800138000' } })).toThrow();
    expect(OPERATION_SCHEMAS['identity.challenges.create'].input.parse({ body: { purpose: 'enrollment_campaign', enrollmentId: 'enrollment:two', destination: '13800138000' } })).toEqual({
      body: { purpose: 'enrollment_campaign', enrollmentId: 'enrollment:two', destination: '13800138000' },
    });
    expect(() => OPERATION_SCHEMAS['identity.challenges.create'].input.parse({ body: { purpose: 'phone_change', destination: '13800138000' } })).toThrow();
    expect(OPERATION_SCHEMAS['identity.mobile.challenges.create'].input.parse({ body: { destination: '13800138000' } })).toEqual({ body: { destination: '13800138000' } });
  });

  it('requires current-account step-up before delivering a new-mobile challenge', () => {
    const operation = OperationCatalog.get('identity.mobile.challenges.create');
    expect(operation.assuranceLevel).toBe('mfa');
    expect(operation.errorUnion).toContain('STEPUP_REQUIRED');
  });

  it('keeps every operation on explicit request and response schemas', () => {
    for (const operation of OperationCatalog.all()) {
      expect(operation.method === 'GET' ? definedOperationQuerySchema(operation.requestSchema) : definedOperationBodySchema(operation.requestSchema), `${operation.id} request schema`).toBeDefined();
      expect(definedOperationOutputSchema(operation.responseSchema), `${operation.id} response schema`).toBeDefined();
    }
  });

  it('publishes one strict runtime payload schema for every event', () => {
    const eventTypes = COMMERCE_EVENTS.map(({ type }) => type).sort();
    expect(Object.keys(EVENT_PAYLOAD_SCHEMAS).sort()).toEqual(eventTypes);
    expect(eventTypes).toHaveLength(103);
    expect(parseEventPayload('order.received', { orderId: 'order:one', receivedAt: '2026-08-30T00:00:00.000Z', fulfillmentState: 'received' })).toBeDefined();
    expect(() => parseEventPayload('order.received', { orderId: 'order:one', receivedAt: '2026-08-30', fulfillmentState: 'received' })).toThrow();
    expect(() => parseEventPayload('order.received', { orderId: 'order:one', receivedAt: '2026-08-30T00:00:00.000Z', fulfillmentState: 'received', secret: 'forbidden' })).toThrow();
    expect(() => parseEventPayload('unknown.event', {})).toThrow('EVENT_SCHEMA_UNKNOWN');
  });

  it('validates and freezes the complete event envelope before serialization', () => {
    const event = serializeEvent({
      eventId: 'event:one',
      eventType: 'order.received',
      occurredAt: '2026-08-30T00:00:00.000Z',
      aggregateId: 'order:one',
      aggregateVersion: 1,
      scopeId: 'mall:one',
      actorId: 'member:one',
      correlationId: 'trace:one',
      causationId: 'command:one',
      payloadVersion: 1,
      payload: { orderId: 'order:one', receivedAt: '2026-08-30T00:00:00.000Z', fulfillmentState: 'received' },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.payload)).toBe(true);
    expect(() => serializeEvent({ ...event, aggregateVersion: 0 })).toThrow();
  });

  it('rejects undeclared sensitive request and response fields', () => {
    expect(() =>
      OPERATION_SCHEMAS['identity.providers.manage'].input.parse({
        path: { providerid: 'provider:one' },
        body: {
          type: 'oidc',
          issuer: null,
          scopes: [],
          status: 'disabled',
          clientid: 'client',
          secretref: 'secret/ref',
          role: 'owner',
        },
      })
    ).toThrow();
    expect(() =>
      OPERATION_SCHEMAS['identity.providers.test'].output.parse({
        status: 'healthy',
        checkedat: '2026-08-30T00:00:00.000Z',
        secret: 'exposed',
      })
    ).toThrow();
  });

  it('publishes a strict product detail aggregate instead of an untyped response', () => {
    const detail = {
      id: 'product:one',
      title: '测试商品',
      product_type: 'physical',
      status: 'active',
      version: '1',
      category_id: 'category:one',
      brand_id: null,
      owner_partner_id: 'supplier:one',
      cover_url: null,
      subtitle: null,
      skus: [{ id: 'sku:one', code: 'SKU-1', status: 'active', specifications: [{ name: '规格', value: '标准' }], version: '1' }],
      listings: [],
      inventory: [],
      prices: [],
    } as const;
    expect(OPERATION_SCHEMAS['catalog.product.detail.read'].output.parse(detail)).toEqual(detail);
    expect(() => OPERATION_SCHEMAS['catalog.product.detail.read'].output.parse({ ...detail, internalSecret: 'forbidden' })).toThrow();
    expect(OperationCatalog.get('catalog.product.detail.read')).toMatchObject({
      resourceResolver: 'catalog.resource',
      resourceParameter: null,
    });
  });

  it('publishes shared session identity Operations for both browser targets', () => {
    const shared = [
      'identity.tickets.exchange',
      'identity.session.read',
      'identity.session.delete',
      'identity.sessions.read',
      'identity.sessions.revoke',
      'identity.challenges.create',
      'identity.password.change',
      'identity.password.verify',
      'identity.password.reset',
      'identity.mobile.manage',
      'identity.stepup.start',
      'identity.stepup.complete',
      'member.profile.read',
      'order.orders.read',
    ] as const;
    for (const id of shared) expect(OperationCatalog.get(id)).toMatchObject({ audience: 'public', targets: ['console', 'storefront'] });
  });

  it('authorizes multi-mall product commands against the explicit operating scope', () => {
    for (const operation of ['catalog.products.update', 'catalog.products.archive'] as const) {
      expect(OperationCatalog.get(operation)).toMatchObject({ resourceResolver: 'none', resourceParameter: null });
    }
  });

  it('allows every authenticated session to log out without step-up or a fictitious resource version', () => {
    expect(OperationCatalog.get('identity.session.delete')).toMatchObject({
      assuranceLevel: 'session',
      permission: null,
      expectedVersion: 'none',
      csrfPolicy: 'required',
      idempotencyPolicy: 'required',
    });
  });

  it('creates a new card library without pretending that a prior resource version exists', () => {
    expect(OperationCatalog.get('voucher.cardlibraries.create')).toMatchObject({
      assuranceLevel: 'mfa',
      permission: 'voucher.cardlibrary.create',
      makerChecker: false,
      expectedVersion: 'none',
      csrfPolicy: 'required',
      idempotencyPolicy: 'required',
    });
  });

  it('publishes the complete Referral, repair, receipt and checkout contract without old aliases', () => {
    const required = [
      'referral.settings.read',
      'referral.settings.manage',
      'referral.products.read',
      'referral.products.manage',
      'referral.members.read',
      'referral.members.apply',
      'referral.members.approve',
      'referral.members.disqualify',
      'referral.bindings.read',
      'referral.bindings.create',
      'referral.commissions.read',
      'referral.earnings.read',
      'referral.links.read',
      'referral.withdrawals.read',
      'referral.withdrawals.create',
      'finance.policies.read',
      'finance.policies.preview',
      'finance.reconciliationrepairs.read',
      'finance.reconciliationrepairs.preview',
      'finance.reconciliationrepairs.submit',
      'finance.reconciliationrepairs.decide',
      'finance.reconciliationrepairs.reverse',
      'order.orders.receive',
      'checkout.quotes.current.read',
    ] as const;
    for (const id of required) expect(OperationCatalog.get(id).id).toBe(id);
    for (const id of ['identity.members.create', 'identity.members.reset', 'identity.wechat.session', 'identity.wechat.bind', 'invoice.operatorprofiles.read', 'finance.audit.read']) {
      expect(() => OperationCatalog.get(id as never)).toThrow('OPERATION_UNKNOWN');
    }
    for (const id of [
      'referral.settings.manage',
      'referral.products.manage',
      'referral.members.approve',
      'referral.members.disqualify',
      'finance.reconciliationrepairs.submit',
      'finance.reconciliationrepairs.decide',
      'finance.reconciliationrepairs.reverse',
    ]) {
      expect(OperationCatalog.get(id as never)).toMatchObject({ assuranceLevel: 'stepup', makerChecker: true, expectedVersion: 'required', idempotencyPolicy: 'required' });
    }
    expect(OperationCatalog.get('referral.withdrawals.create')).toMatchObject({ assuranceLevel: 'stepup', expectedVersion: 'required', idempotencyPolicy: 'required' });
    expect(OperationCatalog.get('order.orders.receive')).toMatchObject({ expectedVersion: 'required', idempotencyPolicy: 'required', idempotent: true });
  });

  it('rejects imprecise Referral, Finance, receipt and Checkout wire values', () => {
    expect(
      OPERATION_SCHEMAS['referral.settings.manage'].input.parse({
        path: { settingid: 'referralsetting:one' },
        body: { enabled: true, firstTouchDays: 30, rateBasisPoints: 500, minimumWithdrawalMinor: 1000, currency: 'CNY', expectedVersion: 1, reason: '年度政策' },
      })
    ).toBeDefined();
    expect(() =>
      OPERATION_SCHEMAS['referral.settings.manage'].input.parse({
        path: { settingid: 'referralsetting:one' },
        body: { enabled: true, firstTouchDays: 30, rateBasisPoints: 1.5, minimumWithdrawalMinor: 1000, currency: 'CNY', expectedVersion: 1, reason: '非法小数佣金' },
      })
    ).toThrow();
    expect(() => OPERATION_SCHEMAS['order.orders.receive'].input.parse({ path: { orderid: 'order:one' }, body: { expectedVersion: 0 } })).toThrow();
    expect(() => OPERATION_SCHEMAS['checkout.quotes.current.read'].output.parse({ quote: { internalSecret: 'forbidden' } })).toThrow();
  });

  it('exposes every employee journey operation to the storefront target', () => {
    const employeeOperations = [
      'cart.current.read',
      'cart.items.put',
      'cart.items.batch',
      'checkout.quote.create',
      'checkout.quotes.current.read',
      'order.orders.create',
      'order.aftersales.read',
      'order.aftersales.apply',
      'benefit.accounts.read',
      'voucher.bindings.read',
      'voucher.redemptions.read',
      'invoice.requests.create',
      'support.cases.create',
      'payment.intents.read',
      'storefront.bootstrap.read',
      'storefront.catalog.read',
    ] as const;
    expect(employeeOperations.every((id) => (OperationCatalog.get(id).targets as readonly string[]).includes('storefront'))).toBe(true);
    expect(OperationCatalog.all().filter((operation) => (operation.targets as readonly string[]).includes('storefront')).length).toBeGreaterThanOrEqual(employeeOperations.length);
  });

  it('publishes explicit statuses for employee transaction errors', () => {
    expect((['INVENTORY_INSUFFICIENT', 'CART_EMPTY', 'PRICE_QUOTE_EXPIRED', 'BENEFIT_BALANCE_INSUFFICIENT', 'LISTING_NOT_PURCHASABLE'] as const).map((code) => errorStatus(code))).toEqual([409, 409, 409, 409, 409]);
    expect(errorDefinition(['UNREGISTERED', 'INVALID'].join('_'))).toBeUndefined();
  });

  it('accepts only the single experience schema version, components and actions', () => {
    expect(parseExperience({ version: 2, application: 'app', pages: [{ id: 'home', path: '/', blocks: [{ id: 'hero', component: 'hero', content: {}, action: { type: 'product', target: 'product-1' } }] }] }).version).toBe(2);
    expect(EXPERIENCE_COMPONENTS).toEqual(['hero', 'notice', 'shortcut', 'productcollection', 'richtext']);
    expect(() => parseExperience({ version: 2, application: 'app', pages: [{ id: 'home', path: '/', blocks: [{ id: 'unknown', component: 'unknown', content: {} }] }] })).toThrow('EXPERIENCE_COMPONENT_INVALID');
    expect(() => parseExperience({ version: 1, application: 'app', pages: [] })).toThrow('EXPERIENCE_VERSION_INVALID');
  });

  it('serializes experience documents canonically for content addressed publication', () => {
    const left = serializeExperience({ pages: [{ blocks: [], path: '/', id: 'home' }], application: 'app', version: 2 });
    const right = serializeExperience({ version: 2, application: 'app', pages: [{ id: 'home', path: '/', blocks: [] }] });
    expect(left).toBe(right);
  });
});
