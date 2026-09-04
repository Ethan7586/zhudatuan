import { OPERATION_SCHEMAS } from '@shop/contract';
import { describe, expect, it, vi } from 'vitest';
import type { CipherEnvelope } from '../../../foundation/application/KmsPort';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { readHandlerContext } from '../../../test/HandlerFixture';
import { result, withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';
import { CustomersGetHandler } from '../application/handler/CustomersGetHandler';
import { CustomerOptionsHandler } from '../application/handler/CustomerOptionsHandler';
import { ChangeCustomerState } from '../application/process/ChangeCustomerState';
import { ProtectCustomerData } from '../application/process/ProtectCustomerData';
import { Agreement } from '../domain/model/Agreement';
import { Contact } from '../domain/model/Contact';
import { Customer } from '../domain/model/Customer';
import { Partner } from '../domain/model/Partner';
import { PgCustomerRepository } from '../infrastructure/persistence/PgCustomerRepository';

describe('partner customer fusion operations', () => {
  it('keeps enterprise customers distinct from members and validates lifecycle invariants', () => {
    const customer = new Customer('partnercustomer:one', 'enterprise', '测试企业客户', 'draft', 1);
    expect(() => customer.enable(false)).toThrow('PARTNER_CUSTOMER_STATE_INVALID');
    expect(customer.enable(true)).toBe('active');
    expect(() => new Customer('member:one', 'enterprise', '测试企业客户', 'draft', 1)).toThrow('VALIDATION_FAILED');
    expect(() => new Partner('supplier:one', 'disabled' as never)).toThrow('VALIDATION_FAILED');
    expect(() => new Partner('supplier:one', 'suspended').assertAcceptsNewBusiness()).toThrow('PARTNER_CUSTOMER_STATE_INVALID');
  });

  it('normalizes contact data, exposes only masks and rejects invalid agreement periods', () => {
    expect(new Contact('primary', { name: '张小明', phone: '13800138000', email: 'USER@example.com' }).masked()).toEqual({ name: '张**', phone: '138****8000', email: 'us***@example.com' });
    expect(() => new Contact('primary', { name: '张小明' })).toThrow('PARTNER_CONTACT_INVALID');
    expect(
      () => new Agreement({ contractRef: 'HT-1', contractHash: 'a'.repeat(64), capabilities: ['voucher.issue'], effectiveAt: '2026-09-05T00:00:00.000Z', expiresAt: '2026-09-04T00:00:00.000Z' })
    ).toThrow('PARTNER_AGREEMENT_PERIOD_INVALID');
  });

  it('protects identifier and contact fields before opening the write transaction', async () => {
    const encrypt = vi.fn(async (): Promise<CipherEnvelope> => ({ ciphertext: 'ciphertext:protected', fingerprint: 'a'.repeat(64), keyVersion: 'key:1' }));
    const command = await new ProtectCustomerData({ encrypt } as never).create(
      {
        body: {
          identifier: ' 9131 0000 abc ', name: '测试企业客户', kind: 'enterprise',
          contact: { name: '张小明', phone: '13800138000', email: 'USER@example.com' },
          agreement: { contractRef: 'HT-1', contractHash: 'b'.repeat(64), capabilities: ['voucher.issue'], effectiveAt: '2026-09-04T00:00:00.000Z', expiresAt: '2027-09-04T00:00:00.000Z' },
        },
      } as never,
      context('partner.customers.create') as never
    );
    expect(encrypt).toHaveBeenCalledTimes(4);
    expect(command).toMatchObject({ tenant: 'tenant:one', scope: 'mall:one', identifierMasked: '9131****0ABC', contact: { nameMasked: '张**', phoneMasked: '138****8000', emailMasked: 'us***@example.com' } });
    expect(JSON.stringify(command)).not.toContain('user@example.com');
  });

  it('maps the tenant identifier uniqueness constraint to a stable conflict result', async () => {
    const queries: string[] = [];
    const output = await withWriteTransaction(
      async (text) => {
        queries.push(text);
        return result([]);
      },
      (transaction) => new PgCustomerRepository().create(transaction, createCommand())
    );
    expect(output).toBe('identifierconflict');
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('on conflict(tenant_id,identifier_hash) do nothing');
  });

  it('never returns ciphertext and always binds customer detail reads to the selected scope', async () => {
    const seen: unknown[][] = [];
    const projected = await withReadTransaction(
      async (text, values) => {
        seen.push(values as unknown[]);
        expect(text).not.toContain('identifier_ciphertext');
        expect(text).not.toContain('name_ciphertext');
        return result([customerRow()]);
      },
      async (transaction) => {
        const reply = await new CustomersGetHandler(new PgCustomerRepository()).execute({ path: { customerid: 'partnercustomer:one' } } as never, readHandlerContext('partner.customers.get', transaction));
        OPERATION_SCHEMAS['partner.customers.get'].output.parse(reply.body);
        return reply.body;
      }
    );
    expect(seen).toEqual([['mall:one', 'partnercustomer:one']]);
    expect(projected.contacts).toEqual([expect.objectContaining({ phoneMasked: '138****8000' })]);
    expect(JSON.stringify(projected)).not.toContain('ciphertext');
  });

  it('requires an effective agreement to enable, preserves history on disable, and checks versions', async () => {
    const setState = vi.fn(async (_transaction, input) => ({ ...projection(), status: input.target, version: 3 }));
    const change = new ChangeCustomerState({ lock: async () => ({ id: 'partnercustomer:one', name: '测试企业客户', kind: 'enterprise', status: 'draft', version: 2, agreementEffective: false }), setState } as never);
    await expect(change.execute({ path: { customerid: 'partnercustomer:one' }, body: { reason: '协议已核对' } } as never, writeContext('partner.customers.enable', 2) as never, 'active')).rejects.toThrow('PARTNER_CUSTOMER_STATE_INVALID');
    expect(setState).not.toHaveBeenCalled();

    const disabling = new ChangeCustomerState({ lock: async () => ({ id: 'partnercustomer:one', name: '测试企业客户', kind: 'enterprise', status: 'active', version: 2, agreementEffective: true }), setState } as never);
    const disabled = await disabling.execute({ path: { customerid: 'partnercustomer:one' }, body: { reason: '合同到期' } } as never, writeContext('partner.customers.disable', 2) as never, 'disabled');
    expect(disabled).toMatchObject({ id: 'partnercustomer:one', status: 'disabled', version: 3 });
    expect(setState).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ current: 'active', target: 'disabled', expectedVersion: 2 }));
  });

  it('lets Voucher resolve only active customers with effective approved agreements', async () => {
    const summary = await withReadTransaction(
      async (text, values) => {
        expect(text).toContain("customer.status='active'");
        expect(text).toContain("agreement.status='active'");
        expect(text).toContain('agreement.effective_at<=clock_timestamp()');
        expect(values).toEqual(['partnercustomer:one', 'mall:one']);
        return result([{ id: 'partnercustomer:one', scope: 'mall:one', name: '测试企业客户', kind: 'enterprise', agreementVersion: 2, agreementExpiresAt: new Date('2027-09-04T00:00:00.000Z') }]);
      },
      (transaction) => new PgCustomerRepository().approved(transaction, 'partnercustomer:one', 'mall:one')
    );
    expect(summary).toEqual({ id: 'partnercustomer:one', scope: 'mall:one', name: '测试企业客户', kind: 'enterprise', agreementVersion: 2, agreementExpiresAt: '2027-09-04T00:00:00.000Z' });
  });

  it('returns lightweight options only and bounds search to the current scope', async () => {
    const transaction = {} as ReadTransactionContext;
    const options = vi.fn(async () => [{ id: 'partnercustomer:one', name: '测试企业客户', kind: 'enterprise' as const, agreementExpiresAt: '2027-09-04T00:00:00.000Z', version: 2 }]);
    const reply = await new CustomerOptionsHandler({ options } as never).execute(
      { query: { q: '测试', limit: '20' } } as never,
      readHandlerContext('partner.customeroptions.list', transaction)
    );
    expect(options).toHaveBeenCalledWith(transaction, { scope: 'mall:one', q: '测试', limit: 20 });
    expect(reply.body).toEqual({ items: [{ id: 'partnercustomer:one', name: '测试企业客户', kind: 'enterprise', agreementExpiresAt: '2027-09-04T00:00:00.000Z', version: 2 }], count: 1 });
    expect(JSON.stringify(reply.body)).not.toContain('contact');
  });
});

function envelope(): CipherEnvelope {
  return { ciphertext: 'ciphertext:protected', fingerprint: 'a'.repeat(64), keyVersion: 'key:1' };
}

function createCommand() {
  return {
    id: 'partnercustomer:one', tenant: 'tenant:one', scope: 'mall:one', identifier: envelope(), identifierMasked: '9131****0ABC', name: '测试企业客户', kind: 'enterprise' as const, actor: 'membership:one',
    contact: { id: 'customercontact:one', kind: 'primary' as const, name: envelope(), phone: envelope(), email: null, nameMasked: '张**', phoneMasked: '138****8000', emailMasked: null }, agreement: null,
  };
}

function customerRow() {
  return { ...projection(), createdAt: new Date('2026-09-04T00:00:00.000Z'), updatedAt: new Date('2026-09-04T00:00:00.000Z') };
}

function projection() {
  return {
    id: 'partnercustomer:one', scopeId: 'mall:one', identifierMasked: '9131****0ABC', name: '测试企业客户', kind: 'enterprise' as const, status: 'active' as const, version: 2,
    contacts: [{ id: 'customercontact:one', kind: 'primary' as const, nameMasked: '张**', phoneMasked: '138****8000', emailMasked: null, configured: true as const, version: 1 }],
    agreement: { id: 'customeragreement:one', contractRef: 'HT-1', contractHash: 'b'.repeat(64), capabilities: ['voucher.issue'], status: 'active' as const, effectiveAt: '2026-09-04T00:00:00.000Z', expiresAt: '2027-09-04T00:00:00.000Z', version: 2 },
    createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
  };
}

function context(operation: string) {
  return { operation, expectedVersion: 2, security: { kind: 'session', access: { membership: { id: 'membership:one' }, scope: { id: 'mall:one', kind: 'mall', tenant: 'tenant:one' } } } };
}

function writeContext(operation: string, expectedVersion: number) {
  return { ...context(operation), expectedVersion, transaction: {} };
}
