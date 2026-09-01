import { CONTRACT_VERSION, OperationCatalog, type OperationId, type OperationOutputFor } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { ApiClient } from './ApiClient';
import type { OperationDescriptor, OperationExecutor } from './OperationDescriptor';
import { createApprovalOperations } from './operations/approval';
import { PARTNER_OPERATION_IDS, createFetchPartner, createPartnerOperations } from './operations/partner';
import { SDK_OPERATION_IDS } from './operations/CommerceClient.generated';
import { VOUCHER_OPERATION_IDS, createVoucherOperations } from './operations/voucher';
import type { RequestContext } from './RequestContext';

describe('voucher target SDK', () => {
  it('generates every frozen target into its owner SDK without changing runtime registration', () => {
    const frozen = OperationCatalog.frozen();
    const generated = new Set<OperationId>(SDK_OPERATION_IDS);
    expect(frozen).toHaveLength(74);
    expect(frozen.every(({ id }) => generated.has(id))).toBe(true);
    expect(PARTNER_OPERATION_IDS.filter((id) => OperationCatalog.definition(id).availability === 'frozen')).toHaveLength(7);
    expect(VOUCHER_OPERATION_IDS.filter((id) => OperationCatalog.definition(id).availability === 'frozen')).toHaveLength(57);
    expect(Object.keys(createApprovalOperations(recorder())).length).toBe(10);
  });

  it('carries the canonical policy in generated descriptors', async () => {
    const descriptors: OperationDescriptor<OperationId>[] = [];
    const executor = recorder(descriptors);
    await createPartnerOperations(executor).customersUpdate({ path: { customerid: 'customer:1' }, body: {} }, context());
    await createVoucherOperations(executor).credentialsGenerate({ path: { poolid: 'pool:1' }, body: {} }, context());
    expect(descriptors).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'partner.customers.update', availability: 'frozen', idempotency: 'required', expectedVersion: 'required', execution: 'sync' }),
      expect.objectContaining({ id: 'voucher.credentials.generate', availability: 'frozen', idempotency: 'required', expectedVersion: 'required', execution: 'async' }),
    ]));
  });

  it('refuses a frozen operation before issuing an HTTP request', async () => {
    await expect(createFetchPartner('https://shop.example').customersCreate({ body: {} }, context({ idempotencyKey: 'customer:create:1' })))
      .rejects.toThrow('SDK_OPERATION_FROZEN');
  });

  it('simulates all frozen operations and prevents every transport call', async () => {
    const descriptors: OperationDescriptor<OperationId>[] = [];
    const capture = recorder(descriptors);
    await record(createPartnerOperations(capture));
    await record(createApprovalOperations(capture));
    await record(createVoucherOperations(capture));
    const frozen = descriptors.filter(({ availability }) => availability === 'frozen');
    expect(frozen.map(({ id }) => id).sort()).toEqual(OperationCatalog.frozen().map(({ id }) => id).sort());

    let requestCount = 0;
    const client = new ApiClient('https://shop.example', {
      send() {
        requestCount += 1;
        return Promise.resolve({ status: 200, headers: {}, body: '{}' });
      },
    });
    for (const operation of frozen) {
      await expect(client.execute(operation, {} as never, context({ idempotencyKey: `simulation:${operation.id}`, expectedVersion: 1 })))
        .rejects.toThrow('SDK_OPERATION_FROZEN');
    }
    expect(requestCount).toBe(0);
  });
});

function recorder(target: OperationDescriptor<OperationId>[] = []): OperationExecutor {
  return {
    execute<TKey extends OperationId>(operation: OperationDescriptor<TKey>): Promise<OperationOutputFor<TKey>> {
      target.push(operation as OperationDescriptor<OperationId>);
      return Promise.resolve({} as OperationOutputFor<TKey>);
    },
  };
}

function context(values: Partial<RequestContext> = {}): RequestContext {
  return { contractVersion: CONTRACT_VERSION, traceId: 'trace:voucher-target', clientVersion: '1.0.0', ...values };
}

async function record(operations: object): Promise<void> {
  for (const method of Object.values(operations)) {
    await (method as (input: unknown, context: RequestContext) => Promise<unknown>)({}, context());
  }
}
