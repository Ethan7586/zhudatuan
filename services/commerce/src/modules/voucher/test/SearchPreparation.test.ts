import { describe, expect, it, vi } from 'vitest';
import type { OperationInputFor } from '@shop/contract';
import { pgTransactionState } from '../../../adapter/database/PgTransactionState';
import { OperationExecutor } from '../../../foundation/application/OperationExecutor';
import { AuditDecorator } from '../../../foundation/application/AuditDecorator';
import type { AuditAppender } from '../../../foundation/application/AuditAppender';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { result, transactionManager, withWriteTransaction } from '../../../test/TransactionFixture';
import { VoucherApplication } from '../application/service/VoucherApplication';
import { PreparedVoucherSearch } from '../application/service/PreparedVoucherSearch';
import { SearchReadHandler } from '../application/handler/SearchReadHandler';
import { SearchFacetsReadHandler } from '../application/handler/SearchFacetsReadHandler';
import { SearchSnapshotsCreateHandler } from '../application/handler/SearchSnapshotsCreateHandler';
import { VouchersGetByNumberHandler } from '../application/handler/VouchersGetByNumberHandler';
import { PgVoucherSearch } from '../infrastructure/persistence/PgVoucherSearch';
import { PgVoucherRepository } from '../infrastructure/persistence/PgVoucherRepository';

describe('voucher search preparation and audit', () => {
  it('prepares facet lookup once outside the transaction and preserves read mode', async () => {
    const data = fixture();
    const handler = new SearchFacetsReadHandler(data.application);
    const reply = await data.executor.execute(handler, { query: { query: 'vc001234' } }, readHandlerContext(handler.operation, {} as ReadTransactionContext));
    expect(handler.mode).toBe('read');
    expect(reply.status).toBe(200);
    expect(data.fingerprint).toHaveBeenCalledExactlyOnceWith('VC001234', 'number', 'mall:one');
    expect(data.query.mock.calls.some(([sql]) => sql.includes('with filtered as materialized'))).toBe(true);
  });

  it('commits snapshot creation inside its write transaction and finalizes the exact same receipt without preparing twice', async () => {
    const data = fixture();
    const handler = new SearchSnapshotsCreateHandler(data.application);
    const input = { body: { filter: { query: 'vc001234' } } } as OperationInputFor<typeof handler.operation>;
    const context = readHandlerContext(handler.operation, {} as ReadTransactionContext);
    const prepared = await handler.prepare(input, context);
    const committed = await withWriteTransaction(data.query, transaction => handler.commit(input, prepared, { ...context, transaction }));
    expect(handler.mode).toBe('write');
    expect(committed.response).toMatchObject({ status: 201, body: { count: 0 } });
    expect(await handler.finalize(input, committed.checkpoint)).toBe(committed.response);
    expect(data.query.mock.calls.some(([sql]) => sql.includes('insert into voucher.searchsnapshotitem'))).toBe(true);
    expect(data.fingerprint).toHaveBeenCalledTimes(1);
  });

  it('prepares the HMAC outside the transaction and redacts a full number in the search audit', async () => {
    const data = fixture();
    const input = { query: { query: 'vc001234', state: 'active' } } as OperationInputFor<'voucher.search.read'>;
    await data.executor.execute(new SearchReadHandler(data.application), input, readHandlerContext('voucher.search.read', {} as ReadTransactionContext));
    expect(data.fingerprint).toHaveBeenCalledExactlyOnceWith('VC001234', 'number', 'mall:one');
    expect(data.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ before: { query: { query: '[REDACTED]', state: 'active' } } }));
    expect(JSON.stringify(data.audit.mock.calls)).not.toContain('vc001234');
    expect(input.query?.query).toBe('vc001234');
  });

  it('normalizes direct number lookup before opening the transaction and masks its audit resource', async () => {
    const data = fixture();
    await data.executor.execute(new VouchersGetByNumberHandler(data.application), { path: { number: 'vc001234' }, query: {} },
      readHandlerContext('voucher.vouchers.getbynumber', {} as ReadTransactionContext));
    expect(data.fingerprint).toHaveBeenCalledExactlyOnceWith('VC001234', 'number', 'mall:one');
    expect(data.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      object: { type: 'voucher', id: '[REDACTED]' },
      before: { path: { number: '[REDACTED]' }, query: {} },
    }));
    expect(JSON.stringify(data.audit.mock.calls)).not.toContain('vc001234');
  });

  it.each([
    { query: 'a'.repeat(129) }, { query: 'VC00\u00001234' }, { expiresBefore: 'not a date' },
    { expiresAfter: '2026-09-06T00:00:00.000Z', expiresBefore: '2026-09-05T00:00:00.000Z' },
  ])('rejects invalid filters before performing remote work', async query => {
    const fingerprint = vi.fn();
    const service = new PreparedVoucherSearch({} as never, { fingerprint });
    await expect(service.prepare({ query } as never, 'mall:one')).rejects.toThrow('VALIDATION_FAILED');
    expect(fingerprint).not.toHaveBeenCalled();
  });

  it('normalizes the same filter identically for list, facets and snapshot preparation', async () => {
    const service = new PreparedVoucherSearch({} as never, { fingerprint: vi.fn(async () => 'f'.repeat(64)) });
    const filter = { query: ' vc001234 ', product: 'product:one', expiresBefore: '2026-12-05T00:00:00.000Z' };
    expect(await service.prepare({ query: { ...filter, limit: 20, cursor: 'voucher:last' } } as never, 'mall:one'))
      .toEqual(await service.prepare({ body: { filter } } as never, 'mall:one'));
  });
});

function fixture() {
  const fingerprint = vi.fn(async () => {
    expect(pgTransactionState.getStore()?.open ?? false).toBe(false);
    return 'f'.repeat(64);
  });
  const query = vi.fn(async (sql: string) => {
    expect(pgTransactionState.getStore()?.open).toBe(true);
    return result(sql.includes('voucher.number_fingerprint=$2') ? [{ id: 'voucher:one', numberMasked: '****1234' }] : []);
  });
  const audit = vi.fn<AuditAppender['append']>(async () => { expect(pgTransactionState.getStore()?.open).toBe(true); });
  const search = new PreparedVoucherSearch(new PgVoucherSearch(), { fingerprint });
  const application = new VoucherApplication({ member: vi.fn() }, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    new PgVoucherRepository({} as never, {} as never, {} as never, {} as never), {} as never, search, {} as never, {} as never);
  const executor = new OperationExecutor(transactionManager(query), { claim: vi.fn(), checkpoint: vi.fn(), complete: vi.fn() },
    { verify: vi.fn() }, new AuditDecorator({ append: audit }), { append: vi.fn() });
  return { application, executor, audit, fingerprint, query };
}
