import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { getFinanceOverviewOperations } from './GetFinanceOverview';

describe('finance overview read model', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      create schema organization;
      create schema finance;
      create table organization.unitclosure(ancestor_id text not null,descendant_id text not null);
      create table finance.account(id text primary key,scope_id text not null,code text not null,kind text not null,currency char(3) not null);
      create table finance.journal(id text primary key,scope_id text not null,state text not null,posted_at timestamptz);
      create table finance.entry(id text primary key,journal_id text not null,account_id text not null,side text not null,amount_minor bigint not null);
      insert into organization.unitclosure values('mall:one','mall:one');
      insert into finance.account values('account:cash','mall:one','cash','asset','CNY');
      insert into finance.journal values
        ('journal:posted','mall:one','posted','2026-08-28T01:00:00Z'),
        ('journal:draft','mall:one','draft',null),
        ('journal:reversed','mall:one','reversed','2026-08-28T02:00:00Z');
      insert into finance.entry values
        ('entry:posted','journal:posted','account:cash','debit',100),
        ('entry:draft','journal:draft','account:cash','debit',900),
        ('entry:reversed','journal:reversed','account:cash','debit',800);
    `);
  });

  afterEach(async () => database.close());

  it('excludes draft and reversed journals and preserves bigint wire values as decimal text', async () => {
    const action = getFinanceOverviewOperations()['finance.overview.read'];
    if (typeof action !== 'function') throw new Error('FINANCE_OVERVIEW_ACTION_MISSING');
    const result = await action(request(), database as unknown as OperationDatabase);

    expect(result).toEqual({
      status: 200,
      body: {
        items: [
          {
            currency: 'CNY',
            balance_minor: '100',
            liability_minor: '0',
            income_minor: '0',
            expense_minor: '0',
            cash_minor: '100',
            journal_count: 1,
            watermark: new Date('2026-08-28T01:00:00.000Z'),
          },
        ],
      },
    });
  });
});

function request(): OperationRequest {
  return {
    type: 'finance.overview.read',
    access: {
      scope: { id: 'mall:one', kind: 'mall' },
      actor: { id: 'member:one' },
      trace: 'trace:overview',
    },
    input: {},
  } as unknown as OperationRequest;
}
