import { describe, expect, it } from 'vitest';
import { errorStatus, EXPERIENCE_COMPONENTS, OPERATION_SCHEMAS, OperationCatalog, parseExperience, serializeExperience } from './index';

describe('contract truth', () => {
  it('keeps operation identifiers and routes unique', () => {
    const operations = OperationCatalog.all();
    expect(new Set(operations.map((item) => item.id)).size).toBe(operations.length);
    expect(new Set(operations.map((item) => `${item.method} ${item.path}`)).size).toBe(operations.length);
  });

  it('publishes one runtime schema pair for every Operation', () => {
    const operationIds = OperationCatalog.all().map(({ id }) => id).sort();
    expect(Object.keys(OPERATION_SCHEMAS).sort()).toEqual(operationIds);
    expect(new Set(Object.values(OPERATION_SCHEMAS).map(({ fidelity }) => fidelity))).toEqual(new Set(['structural']));
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

  it('classifies every employee journey operation as member audience', () => {
    const employeeOperations = [
      'cart.current.read', 'cart.items.put', 'cart.items.batch', 'checkout.quote.create', 'order.orders.create', 'order.orders.read',
      'order.aftersales.read', 'order.aftersales.apply', 'benefit.accounts.read', 'voucher.bindings.read', 'voucher.redemptions.read',
<<<<<<< HEAD
      'support.cases.create', 'payment.intents.create', 'catalog.listings.read', 'pricing.offers.read',
      'inventory.availability.read',
    ] as const;
    expect(employeeOperations.map((id) => OperationCatalog.get(id).audience)).toEqual(employeeOperations.map(() => 'member'));
    expect(OperationCatalog.get('invoice.requests.create').audience).toBe('operator');
=======
      'invoice.requests.create', 'support.cases.create', 'payment.intents.create', 'catalog.listings.read', 'pricing.offers.read',
      'inventory.availability.read',
    ] as const;
    expect(employeeOperations.map((id) => OperationCatalog.get(id).audience)).toEqual(employeeOperations.map(() => 'member'));
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    expect(OperationCatalog.all().filter((operation) => operation.audience === 'member').length).toBeGreaterThanOrEqual(35);
  });

  it('publishes explicit statuses for employee transaction errors', () => {
    expect(['INVENTORY_INSUFFICIENT', 'CART_EMPTY', 'PRICE_QUOTE_EXPIRED', 'BENEFIT_BALANCE_INSUFFICIENT', 'LISTING_NOT_PURCHASABLE']
      .map(errorStatus)).toEqual([409, 409, 409, 409, 409]);
    expect(errorStatus(['UNREGISTERED', 'INVALID'].join('_'))).toBeUndefined();
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
