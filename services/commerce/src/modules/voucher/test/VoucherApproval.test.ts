import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { OperationCatalog } from '@shop/contract';
import type { ApprovalPort, ApprovalReadPort } from '../../approval/public';
import type { ApprovalRepository, ApprovalInstanceRecord } from '../../approval/application/port/ApprovalRepository';
import { PgApprovalPort } from '../../approval/infrastructure/persistence/PgApprovalPort';
import { result, withWriteTransaction } from '../../../test/TransactionFixture';
import { PgIssueOrderRepository } from '../infrastructure/persistence/PgIssueOrderRepository';
import { PgStockRequestRepository } from '../infrastructure/persistence/PgStockRequestRepository';
import { IssueOrder } from '../domain/model/IssueOrder';

const value = { id: 'issue:one', scope: 'mall:one', customer: 'customer:one', product: 'product:one', stockRequest: 'stock:one',
  quantity: 1, purpose: 'manual' as const, delivery: 'claim' as const, startsAt: new Date('2026-09-05'), expiresAt: new Date('2026-12-05'),
  recipientSnapshot: 'snapshot:one', reason: '员工福利', requester: 'actor:one', approval: 'approval:one', state: 'submitted' as const, version: 2 };

describe('voucher approval boundaries', () => {
  it('declares approval configuration and concurrent decision failures in the caller contracts', () => {
    for (const operation of ['voucher.stockrequests.submit', 'voucher.issueorders.submit'] as const)
      expect(OperationCatalog.get(operation).errorUnion).toContain('APPROVAL_TEMPLATE_DISABLED');
    for (const operation of ['voucher.stockrequests.cancel', 'voucher.issueorders.cancel'] as const)
      expect(OperationCatalog.get(operation).errorUnion).toContain('APPROVAL_INSTANCE_CONFLICT');
  });
  it('requires an approved issue order with an approval reference before starting', () => {
    expect(() => new IssueOrder(value).start()).toThrow('VOUCHER_APPROVAL_REQUIRED');
    expect(() => new IssueOrder({ ...value, state: 'approved', approval: null }).start()).toThrow('VOUCHER_APPROVAL_REQUIRED');
    expect(new IssueOrder({ ...value, state: 'approved' }).start().value).toMatchObject({ state: 'issuing', version: 3 });
  });

  describe.each(['stock', 'issue'] as const)('%s request cancellation', kind => {
    it.each(['approved', 'rejected', 'cancelled', 'expired', null])('rejects a %s approval even while its business projection remains submitted', async state => {
      const cancel = vi.fn();
      const read = vi.fn(async () => state ? { id: value.approval, state, version: 3 } : null);
      const query = vi.fn(async () => result([row()]));
      await expect(withWriteTransaction(query, context => execute(kind, { cancel } as unknown as ApprovalPort,
        { read } as unknown as ApprovalReadPort, context))).rejects.toThrow('VOUCHER_STATE_INVALID');
      expect(cancel).not.toHaveBeenCalled();
      expect(query.mock.calls).toHaveLength(1);
    });

    it('rolls back cancellation if a decision wins the version race', async () => {
      const cancel = vi.fn(async () => { throw new Error('VERSION_CONFLICT'); });
      const read = vi.fn(async () => ({ id: value.approval, state: 'pending', version: 2 }));
      const query = vi.fn(async () => result([row()]));
      await expect(withWriteTransaction(query, context => execute(kind, { cancel } as unknown as ApprovalPort,
        { read } as unknown as ApprovalReadPort, context))).rejects.toThrow('VERSION_CONFLICT');
      expect(cancel).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ expectedVersion: 2, requesterId: 'membership:test' }));
      expect(query.mock.calls).toHaveLength(1);
    });
  });

  it.each(['stock', 'issue'] as const)('submits and cancels %s through the real Approval port using membership, not principal identity', async kind => {
    const data = approvalFixture(kind);
    await data.submit();
    expect(data.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requesterId: 'membership:test',
      subjectKind: kind === 'stock' ? 'voucherstock' : 'voucherissue', subjectVersion: 1,
      amountMinor: kind === 'stock' ? null : 1000, currency: kind === 'stock' ? null : 'CNY', constraints: expect.objectContaining({ quantity: 1 }) }));
    const command = data.create.mock.calls[0]![1];
    expect(command.evidenceHash).toBe(createHash('sha256').update(JSON.stringify(command.subjectSnapshot)).digest('hex'));
    await data.cancel();
    expect(data.cancelInstance).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requesterId: 'membership:test', expectedVersion: 1 }));
    expect(data.append.mock.calls).toHaveLength(2);
  });

  it.each(['stock', 'issue'] as const)('does not mark %s submitted when its approval template is disabled', async kind => {
    const data = approvalFixture(kind);
    data.create.mockResolvedValueOnce(null);
    await expect(data.submit()).rejects.toThrow('APPROVAL_TEMPLATE_DISABLED');
    expect(data.query.mock.calls.some(([sql]) => sql.startsWith('update voucher.'))).toBe(false);
    expect(data.append).not.toHaveBeenCalled();
  });
});

function approvalFixture(kind: 'stock' | 'issue') {
  let instance: ApprovalInstanceRecord | null = null;
  const create = vi.fn<ApprovalRepository['createInstance']>(async (_context, command) => {
    instance = { ...command, scopeId: 'scope:test', templateId: 'template:one', templateVersion: 1, state: 'pending',
      currentStep: 1, stepCount: 1, version: 1, createdAt: new Date().toISOString(), decidedAt: null, tasks: [], decisions: [] };
    return { instance, assigned: [] };
  });
  const cancelInstance = vi.fn<ApprovalRepository['cancelInstance']>(async () => ({ id: instance!.id, version: 2, state: 'cancelled' }));
  const repository = { createInstance: create, getInstance: vi.fn(async () => instance), cancelInstance } as unknown as ApprovalRepository;
  const append = vi.fn(async () => undefined);
  const port = new PgApprovalPort(repository, { append });
  const read = { read: vi.fn(async () => instance) } as ApprovalReadPort;
  const stock = new PgStockRequestRepository(port, read);
  const issue = new PgIssueOrderRepository(port, read, {} as never, {} as never);
  const current = { ...row(), scope_id: 'scope:test', requested_by: 'actor:test', state: 'draft', approval_instance_id: null as string | null, version: 1 };
  const query = vi.fn(async (sql: string, parameters?: readonly unknown[]) => {
    if (sql.startsWith('select * from voucher.')) return result([current]);
    if (sql.startsWith('select state from voucher.credentialpool')) return result([{ state: 'open' }]);
    if (sql.startsWith('select product.id product')) return result([{ product: 'product:one', productVersion: 3, pool: 'pool:one',
      faceMinor: 1000, currency: 'CNY', qualification: 'qualification:one', activation: 'secret', startsAt: new Date('2026-01-01'), expiresAt: new Date('2099-01-01') }]);
    if (sql.startsWith('update voucher.') && sql.includes('approval_instance_id=')) {
      current.state = 'submitted'; current.approval_instance_id = String(parameters![2]); current.version = Number(parameters![3]);
    }
    return result([{ ...current, available: 100, approved: 100 }]);
  });
  const call = (transaction: Parameters<Parameters<typeof withWriteTransaction>[1]>[0]) => ({ input: {
    path: { requestid: 'stock:one', orderid: 'issue:one' }, body: { reason: '取消申请' } }, context: { transaction },
    actor: 'actor:test', scope: 'scope:test', expectedVersion: current.version, now: new Date() });
  return { create, append, query, cancelInstance,
    submit: () => withWriteTransaction<unknown>(query, transaction => kind === 'stock' ? stock.submit(call(transaction) as never) : issue.submit(call(transaction) as never)),
    cancel: () => withWriteTransaction<unknown>(query, transaction => kind === 'stock' ? stock.cancel(call(transaction) as never) : issue.cancel(call(transaction) as never)) };
}

function execute(kind: 'stock' | 'issue', approval: ApprovalPort, read: ApprovalReadPort, transaction: Parameters<Parameters<typeof withWriteTransaction>[1]>[0]): Promise<unknown> {
  const call = { input: { path: { orderid: 'issue:one', requestid: 'stock:one' }, body: { reason: '取消申请' } }, context: { transaction },
    scope: value.scope, actor: value.requester, expectedVersion: 2, now: new Date('2026-09-05') };
  return kind === 'stock'
    ? new PgStockRequestRepository(approval, read).cancel(call as unknown as Parameters<PgStockRequestRepository['cancel']>[0])
    : new PgIssueOrderRepository(approval, read, {} as never, {} as never).cancel(call as unknown as Parameters<PgIssueOrderRepository['cancel']>[0]);
}
function row() {
  return { id: value.id, scope_id: value.scope, customer_id: value.customer, product_id: value.product, stock_request_id: value.stockRequest,
    pool_id: 'pool:one', quantity: value.quantity, purpose: value.purpose, delivery: value.delivery, starts_at: value.startsAt,
    expires_at: value.expiresAt, recipient_snapshot: value.recipientSnapshot, reason: value.reason, requested_by: value.requester,
    approval_instance_id: value.approval, state: value.state, version: value.version };
}
