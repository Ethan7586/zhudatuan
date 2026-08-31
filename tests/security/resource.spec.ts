import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OperationCatalog, operationSchema, type OperationId } from '@shop/contract';
import { ResourceResolver } from '../../services/commerce/src/foundation/application/ResourceResolver';

const resources = Object.freeze([
  ['identity.members.manage', 'identity.resource', 'membershipid', 'membership:foreign'],
  ['order.orders.receive', 'order.resource', 'orderid', 'order:foreign'],
  ['support.messages.read', 'support.resource', 'caseid', 'case:foreign'],
  ['invoice.requests.cancel', 'finance.resource', 'requestid', 'invoice:foreign'],
] as const);

test('member, order, case and invoice identifiers are mandatory authorization resources', () => {
  const resolver = new ResourceResolver();
  for (const [id, owner, parameter, foreign] of resources) {
    const operation = OperationCatalog.get(id as OperationId);
    assert.equal(operation.resourceResolver, owner);
    assert.equal(operation.resourceParameter, parameter);
    assert.equal(resolver.resolve(operation, { path: { [parameter]: foreign } }), foreign);
    assert.notEqual(operation.permission, null);
  }
});

test('storefront mall scope cannot be supplied by the browser', () => {
  const catalog = operationSchema('storefront.catalog.read').input;
  assert.equal(catalog.safeParse({ query: { mallId: 'mall:foreign' } }).success, false);
  assert.equal(OperationCatalog.get('storefront.catalog.read').resourceResolver, 'none');
  assert.equal(OperationCatalog.get('storefront.catalog.read').resourceParameter, null);
});
