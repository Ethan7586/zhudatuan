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

  it('keeps provider authorization out of member-controlled notification preferences', () => {
    const preference = OPERATION_SCHEMAS['notification.preferences.manage'].input;
    expect(preference.parse({ path: { channel: 'wechat', eventtype: 'order.created' }, body: { enabled: true, quietHours: null } })).toEqual({
      path: { channel: 'wechat', eventtype: 'order.created' },
      body: { enabled: true, quietHours: null },
    });
    expect(() => preference.parse({ path: { channel: 'wechat', eventtype: 'order.created' }, body: { enabled: true, authorization: 'accepted' } })).toThrow();
  });

  it('bounds self-service referral earnings with the canonical cursor contract', () => {
    const earnings = OPERATION_SCHEMAS['referral.earnings.read'];
    expect(earnings.input.parse({ query: { limit: 50, cursor: 'referralcommission:one' } })).toEqual({ query: { limit: 50, cursor: 'referralcommission:one' } });
    expect(() => earnings.input.parse({ query: { limit: 0 } })).toThrow();
  });

  it('keeps every operation on explicit request and response schemas', () => {
    for (const operation of OperationCatalog.all()) {
      expect(operation.method === 'GET' ? definedOperationQuerySchema(operation.requestSchema) : definedOperationBodySchema(operation.requestSchema), `${operation.id} request schema`).toBeDefined();
      expect(definedOperationOutputSchema(operation.responseSchema), `${operation.id} response schema`).toBeDefined();
    }
  });

  it('publishes bounded server-authoritative order list filters', () => {
    const orders = OPERATION_SCHEMAS['order.orders.read'].input;
    const aftersales = OPERATION_SCHEMAS['order.aftersales.read'].input;
    const filters = {
      search: 'ZD202609050001',
      placed: '7days',
      lifecycle: 'paid',
      payment: 'paid',
      fulfillment: 'allocated',
      mall: 'mall:one',
      channel: 'jdproduct',
      product: '福利礼盒',
      member: '张三',
      minimumMinor: 100,
      maximumMinor: 10000,
    } as const;

    expect(orders.parse({ query: { ...filters, view: 'unshipped', limit: 50 } })).toEqual({ query: { ...filters, view: 'unshipped', limit: 50 } });
    expect(aftersales.parse({ query: filters })).toEqual({ query: filters });
    expect(() => orders.parse({ query: { view: 'removed' } })).toThrow();
    expect(() => aftersales.parse({ query: { payment: 'unknown' } })).toThrow();
  });

  it('publishes customer and member segmentation as a strict sales dimension preset', () => {
    const input = OPERATION_SCHEMAS['reporting.sales.read'].input;
    const output = OPERATION_SCHEMAS['reporting.sales.read'].output;
    const dimensionsOutput = OPERATION_SCHEMAS['reporting.dimensions.read'].output;
    const report = {
      items: [],
      count: 0,
      snapshot: {
        query: { scope: 'mall:one', dimension: 'member', period: '30days', application: null },
        watermark: { event: 'event:one', occurredAt: '2026-09-05T00:00:00.000Z', version: 1 },
        generatedAt: '2026-09-05T00:00:01.000Z',
        generationVersion: 1,
      },
    } as const;
    const dimensions = {
      definitions: [],
      applications: [],
      presets: [
        {
          code: 'customermember',
          name: '客户 / 会员分层',
          description: '当前客户范围内的会员购买分层',
          dimensions: ['customer', 'member'],
          privacy: 'masked',
          version: 1,
          owner: 'reporting',
        },
      ],
    } as const;

    expect(input.parse({ query: { dimensionpreset: 'customermember', period: '30days' } })).toEqual({ query: { dimensionpreset: 'customermember', period: '30days' } });
    expect(output.parse(report)).toEqual(report);
    expect(dimensionsOutput.parse(dimensions)).toEqual(dimensions);
    expect(() => input.parse({ query: { dimensionpreset: 'powderclass' } })).toThrow();
    expect(() => dimensionsOutput.parse({ ...dimensions, presets: [{ ...dimensions.presets[0], privacy: 'raw' }] })).toThrow();
  });

  it('requires metric exports to carry the exact displayed frozen query snapshot', () => {
    const schema = OPERATION_SCHEMAS['reporting.exports.create'].input;
    const body = {
      report: 'metrics',
      filter: { view: 'members', period: '7days', application: 'application:one' },
      snapshot: {
        query: { scope: 'mall:one', dimension: 'member', period: '7days', application: 'application:one' },
        watermark: { event: 'event:one', occurredAt: '2026-09-05T00:00:00.000Z', version: 8 },
        generatedAt: '2026-09-05T00:00:01.000Z',
        generationVersion: 1,
      },
    } as const;

    expect(schema.parse({ body })).toEqual({ body });
    expect(() => schema.parse({ body: { report: 'metrics', filter: body.filter } })).toThrow();
    expect(() => schema.parse({ body: { ...body, report: 'orders' } })).toThrow();
    expect(() => schema.parse({ body: { ...body, filter: { ...body.filter, metric: 'sales' } } })).toThrow();
  });

  it('requires account labels on access-center rows', () => {
    const row = {
      id: 'membership:one',
      display_name: '张三',
      employee_no: 'E1001',
      mobile_masked: '138****0000',
      client: 'console',
      status: 'active',
      access_version: 3,
      roles: [],
      scopes: [],
      overrides: [],
    } as const;
    const schema = OPERATION_SCHEMAS['access.center.read'].output;
    const output = { items: [row], count: 1, roles: [], templates: [], separationRules: [] } as const;

    expect(schema.parse(output)).toEqual(output);
    const withoutAccount = omit(row, 'display_name');
    expect(() => schema.parse({ ...output, items: [withoutAccount] })).toThrow();
  });

  it('requires readable agent labels on support queues and settings', () => {
    const agent = { id: 'agent:one', membership_id: 'membership:one', display_name: '王客服', skills: ['general'], capacity: 10, state: 'available', version: 2 } as const;
    const ticket = {
      id: 'case:one',
      scope_id: 'mall:one',
      priority: 'normal',
      state: 'assigned',
      assigned_agent_id: 'agent:one',
      assigned_agent_name: '王客服',
      response_due_at: '2026-09-09T01:00:00.000Z',
      resolution_due_at: '2026-09-09T08:00:00.000Z',
      created_at: '2026-09-09T00:00:00.000Z',
      updated_at: '2026-09-09T00:30:00.000Z',
      version: 2,
      conversation_id: 'conversation:one',
      skill: 'general',
      member_id: 'member:one',
      order_id: null,
      channel: 'inapp',
      subject: '配送时间咨询',
      reference_type: null,
      reference_id: null,
      unread_count: 1,
      sla_risk: 'normal',
    } as const;

    expect(OPERATION_SCHEMAS['support.agents.read'].output.parse({ items: [agent], count: 1 })).toEqual({ items: [agent], count: 1 });
    expect(OPERATION_SCHEMAS['support.cases.read'].output.parse({ items: [ticket], count: 1 })).toEqual({ items: [ticket], count: 1 });
    expect(() => OPERATION_SCHEMAS['support.agents.read'].output.parse({ items: [omit(agent, 'display_name')], count: 1 })).toThrow();
    expect(() => OPERATION_SCHEMAS['support.cases.read'].output.parse({ items: [omit(ticket, 'assigned_agent_name')], count: 1 })).toThrow();
  });

  it('accepts every published operational role template in access-center output', () => {
    const schema = OPERATION_SCHEMAS['access.center.read'].output;
    const templates = [
      { code: 'storeoperator', name: '门店操作员', description: '门店履约', allows: [], denies: [], version: 1 },
      { code: 'supplieroperator', name: '供应商操作员', description: '供应商履约', allows: [], denies: [], version: 1 },
    ] as const;

    expect(schema.parse({ items: [], count: 0, roles: [], templates, separationRules: [] })).toEqual({
      items: [],
      count: 0,
      roles: [],
      templates,
      separationRules: [],
    });
  });

  it('requires readable parent names on organization layers', () => {
    const row = {
      id: 'enterprise:one',
      kind: 'enterprise',
      parent_id: 'platform:one',
      parent_name: '福利商城平台',
      name: '鸿泰集团',
      timezone: 'Asia/Shanghai',
      status: 'active',
      version: 2,
    } as const;
    const schema = OPERATION_SCHEMAS['organization.layers.read'].output;

    expect(schema.parse({ items: [row], count: 1 })).toEqual({ items: [row], count: 1 });
    const withoutParentName = omit(row, 'parent_name');
    expect(() => schema.parse({ items: [withoutParentName], count: 1 })).toThrow();
  });

  it('requires readable issuer and recipient accounts on invitation rows', () => {
    const row = {
      id: 'invitation:one',
      kind: 'enrollment',
      target: 'storefront',
      organization_id: 'mall:one',
      membership_id: 'membership:employee',
      recipient_display_name: '李小明',
      recipient_employee_no: 'E1002',
      recipient_mobile_masked: '139****0002',
      issuer_membership_id: 'membership:owner',
      issuer_display_name: '王主管',
      issuer_employee_no: 'E1001',
      issuer_mobile_masked: '138****0001',
      issuer_access_version: 3,
      minimum_assurance: 2,
      max_uses: 1,
      use_count: 0,
      not_before: '2026-09-03T00:00:00.000Z',
      expires_at: '2026-09-06T00:00:00.000Z',
      status: 'active',
      reason: '新员工入职',
      created_at: '2026-09-03T00:00:00.000Z',
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
      version: 1,
    } as const;
    const schema = OPERATION_SCHEMAS['identity.invitations.read'].output;

    expect(schema.parse({ items: [row], count: 1 })).toEqual({ items: [row], count: 1 });
    const withoutIssuer = omit(row, 'issuer_display_name');
    expect(() => schema.parse({ items: [withoutIssuer], count: 1 })).toThrow();
  });

  it('requires a readable actor projection on risk-center rows', () => {
    const row = {
      id: 'riskcase:one',
      kind: 'case',
      version: 1,
      name: null,
      status: null,
      active_version: null,
      baseline_version: null,
      rollout_percent: null,
      rule_hash: null,
      rule: null,
      candidate_version: null,
      candidate_rollout: null,
      candidate_hash: null,
      candidate_rule: null,
      replay_state: null,
      sample_count: null,
      changed_count: null,
      false_positive_rate: null,
      preview: null,
      decision_id: 'riskdecision:one',
      outcome: 'deny',
      case_state: 'open',
      safe_reason: 'velocity',
      actor_id: 'principal:one',
      actor_display_name: '李小明',
      actor_mobile_masked: '139****0002',
      score: 90,
      evidence: {},
      created_at: '2026-09-03T00:00:00.000Z',
    } as const;
    const schema = OPERATION_SCHEMAS['risk.center.read'].output;

    expect(schema.parse({ items: [row], count: 1 })).toEqual({ items: [row], count: 1 });
    const withoutActor = omit(row, 'actor_display_name');
    expect(() => schema.parse({ items: [withoutActor], count: 1 })).toThrow();
  });

  it('publishes one strict runtime payload schema for every event', () => {
    const eventTypes = COMMERCE_EVENTS.map(({ type }) => type).sort();
    expect(Object.keys(EVENT_PAYLOAD_SCHEMAS).sort()).toEqual(eventTypes);
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
      section: 'core',
      id: 'product:one',
      title: '测试商品',
      description: null,
      product_type: 'physical',
      status: 'active',
      version: '1',
      category_id: 'category:one',
      brand_id: null,
      owner_partner_id: 'supplier:one',
      cover_url: null,
      subtitle: null,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
      skus: [{ id: 'sku:one', code: 'SKU-1', status: 'active', specifications: [{ name: '规格', value: '标准' }], version: '1' }],
      listings: [],
      media: [],
      channels: [],
      pools: [],
      timeline: [],
      inventory: [],
      prices: [],
      qualifications: [],
      dependencies: {
        catalog: { state: 'ready', watermark: 'catalog:1', code: null },
        inventory: { state: 'notrequested', watermark: null, code: null },
        pricing: { state: 'notrequested', watermark: null, code: null },
        qualification: { state: 'notrequested', watermark: null, code: null },
      },
      gaps: [],
    } as const;
    expect(OPERATION_SCHEMAS['catalog.product.detail.read'].output.parse(detail)).toEqual(detail);
    expect(() => OPERATION_SCHEMAS['catalog.product.detail.read'].output.parse({ ...detail, internalSecret: 'forbidden' })).toThrow();
    expect(OperationCatalog.get('catalog.product.detail.read')).toMatchObject({
      resourceResolver: 'catalog.resource',
      resourceParameter: null,
    });
  });

  it('publishes shared session identity Operations for every session target', () => {
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
    for (const id of shared) expect(OperationCatalog.get(id)).toMatchObject({ audience: 'public', targets: ['console', 'storefront', 'miniapp', 'store', 'supplier'] });
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

  it('creates a new credential pool without pretending that a prior resource version exists', () => {
    expect(OperationCatalog.get('voucher.credentialpools.create')).toMatchObject({
      assuranceLevel: 'stepup',
      permission: 'voucher.credential.manage',
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
      'finance.audit.read',
      'order.orders.receive',
      'checkout.quotes.current.read',
    ] as const;
    for (const id of required) expect(OperationCatalog.get(id).id).toBe(id);
    for (const id of ['identity.members.create', 'identity.members.reset', 'identity.wechat.session', 'identity.wechat.bind', 'invoice.operatorprofiles.read']) {
      expect(() => OperationCatalog.get(id as never)).toThrow('OPERATION_UNKNOWN');
    }
    for (const id of ['referral.settings.manage', 'referral.products.manage', 'referral.members.approve', 'referral.members.disqualify', 'finance.reconciliationrepairs.reverse']) {
      expect(OperationCatalog.get(id as never)).toMatchObject({ assuranceLevel: 'stepup', makerChecker: true, expectedVersion: 'required', idempotencyPolicy: 'required' });
    }
    for (const id of ['finance.reconciliationrepairs.submit', 'finance.reconciliationrepairs.decide'] as const) {
      expect(OperationCatalog.get(id)).toMatchObject({ assuranceLevel: 'stepup', makerChecker: false, expectedVersion: 'required', idempotencyPolicy: 'required' });
    }
    expect(OperationCatalog.get('referral.withdrawals.create')).toMatchObject({ assuranceLevel: 'stepup', expectedVersion: 'required', idempotencyPolicy: 'required' });
    expect(OperationCatalog.get('order.orders.receive')).toMatchObject({ expectedVersion: 'required', idempotencyPolicy: 'required', idempotent: true });
  });

  it('rejects imprecise Referral, Finance, receipt and Checkout wire values', () => {
    const referralSetting = {
      enabled: true,
      recruitEnabled: true,
      reviewRequired: true,
      rewardEnabled: true,
      bindingMode: 'days',
      firstTouchDays: 30,
      freezeDays: 7,
      settlementTrigger: 'received',
      rateBasisPoints: 500,
      minimumWithdrawalMinor: 1000,
      monthlyWithdrawalLimit: 3,
      currency: 'CNY',
      expectedVersion: 1,
      reason: '年度政策',
    } as const;
    expect(
      OPERATION_SCHEMAS['referral.settings.manage'].input.parse({
        path: { settingid: 'referralsetting:one' },
        body: referralSetting,
      })
    ).toBeDefined();
    expect(() =>
      OPERATION_SCHEMAS['referral.settings.manage'].input.parse({
        path: { settingid: 'referralsetting:one' },
        body: { ...referralSetting, rateBasisPoints: 1.5, reason: '非法小数佣金' },
      })
    ).toThrow();
    expect(() => OPERATION_SCHEMAS['order.orders.receive'].input.parse({ path: { orderid: 'order:one' }, body: { expectedVersion: 0 } })).toThrow();
    expect(() => OPERATION_SCHEMAS['checkout.quotes.current.read'].output.parse({ quote: { internalSecret: 'forbidden' } })).toThrow();
    expect(() => OPERATION_SCHEMAS['finance.reconciliationrepairs.preview'].input.parse({ body: { statementId: 'statement:one', sourceHash: 'a'.repeat(64), entries: [], reason: '修复', expectedVersion: 1 } })).toThrow();
    expect(() => OPERATION_SCHEMAS['finance.reconciliationrepairs.decide'].input.parse({ path: { repairid: 'reconciliationrepair:one' }, body: { decision: 'approve', expectedVersion: 1, reason: '同意' } })).toThrow();
    expect(() =>
      OPERATION_SCHEMAS['finance.reconciliationrepairs.decide'].input.parse({ path: { repairid: 'reconciliationrepair:one' }, body: { decision: 'reject', approvalProof: 'p'.repeat(43), expectedVersion: 1, reason: '拒绝' } })
    ).toThrow();
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
      'voucher.search.read',
      'voucher.redemptions.get',
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
    expect(parseExperience(experienceDocument([{ id: 'hero', component: 'hero', content: { title: '福利首页' }, action: { type: 'product', target: 'product-1' } }])).version).toBe(2);
    expect(EXPERIENCE_COMPONENTS).toEqual(['hero', 'notice', 'shortcut', 'productcollection', 'richtext']);
    expect(() => parseExperience(experienceDocument([{ id: 'unknown', component: 'unknown', content: {} }]))).toThrow('EXPERIENCE_COMPONENT_INVALID');
    expect(() => parseExperience({ version: 1, application: 'app', pages: [] })).toThrow('EXPERIENCE_VERSION_INVALID');
  });

  it('serializes experience documents canonically for content addressed publication', () => {
    const left = serializeExperience({
      pages: [{ blocks: [], path: '/', id: 'home' }],
      assets: [],
      navigation: [{ page: 'home', label: '首页', id: 'navigation:home' }],
      theme: { faviconObjectRef: null, logoObjectRef: null, accentColor: '#19A974', primaryColor: '#1F5EFF', preset: 'shop' },
      application: 'app',
      version: 2,
    });
    const right = serializeExperience(experienceDocument([]));
    expect(left).toBe(right);
  });
});

function experienceDocument(blocks: readonly unknown[]) {
  return {
    version: 2,
    application: 'app',
    theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
    navigation: [{ id: 'navigation:home', label: '首页', page: 'home' }],
    assets: [],
    pages: [{ id: 'home', path: '/', blocks }],
  };
}

function omit<T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> {
  const copy = { ...value };
  Reflect.deleteProperty(copy, key);
  return copy;
}
