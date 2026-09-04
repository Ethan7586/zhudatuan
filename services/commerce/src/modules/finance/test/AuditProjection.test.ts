import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { PgTransactionAccess } from '../../../adapter/database/PgTransactionAccess';
import { result, withReadTransaction } from '../../../test/TransactionFixture';
import { PgAuditProjectionRepository } from '../infrastructure/persistence/PgAuditProjectionRepository';

describe('finance audit projection', () => {
  it('executes one bounded graph query and links a source reference through every financial stage', async () => {
    const database = await fixture();
    const statements: string[] = [];
    try {
      const query = async (sql: string, values?: readonly unknown[]) => {
        statements.push(sql);
        const response = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
        return { ...result(response.rows), rowCount: response.affectedRows ?? response.rows.length };
      };
      const projection = await withReadTransaction(query, (context) => new PgAuditProjectionRepository(new PgTransactionAccess()).read(context, ['mall:one'], 'order:one'));

      expect(statements).toHaveLength(1);
      expect(projection.facts.map(({ kind }) => kind)).toEqual(expect.arrayContaining(['journal', 'entry', 'statement', 'reconciliation', 'settlement', 'withdrawal', 'invoice', 'repair']));
      expect(projection.resources).toEqual(expect.arrayContaining(['journal:one', 'entry:one', 'statement:one', 'reconciliation:one', 'settlement:one', 'withdrawal:one', 'invoice:one', 'repair:one']));
      expect(projection.facts.find(({ kind }) => kind === 'entry')).toMatchObject({ business_reference: 'order:one', amount_minor: 100, currency: 'CNY' });
      expect(projection.facts.map(({ id }) => id)).not.toContain('journal:foreign');
      expect(projection.resources).not.toContain('entry:foreign');
    } finally {
      await database.close();
    }
  });
});

async function fixture(): Promise<PGlite> {
  const database = new PGlite();
  await database.exec(`
    create schema finance; create schema invoice;
    create table finance.account(id text primary key,scope_id text,code text,currency char(3));
    create table finance.journal(id text primary key,scope_id text,reference_type text,reference_id text,currency char(3),period text,state text,description text,posted_at timestamptz,version bigint);
    create table finance.entry(id text primary key,journal_id text,account_id text,side text,amount_minor bigint,created_at timestamptz);
    create table finance.statement(id text primary key,scope_id text,period_start date,period_end date,currency char(3),closing_minor bigint,state text,object_ref text,sha256 char(64),generated_at timestamptz,version bigint);
    create table finance.reconciliation(id text primary key,scope_id text,provider text,partner_id text,period text,statement_ref text,statement_hash char(64),state text,difference_minor bigint,updated_at timestamptz,version bigint);
    create table finance.statementline(id text primary key,reconciliation_id text,scope_id text,external_reference text);
    create table finance.reconciliationitem(id text primary key,reconciliation_id text,statement_line_id text,scope_id text,internal_id text);
    create table finance.settlement(id text primary key,scope_id text,reconciliation_id text,partner_id text,period text,amount_minor bigint,currency char(3),state text,paid_at timestamptz,approved_at timestamptz,frozen_at timestamptz,version bigint);
    create table finance.withdrawal(id text primary key,scope_id text,settlement_id text,provider_reference text,state text,amount_minor bigint,currency char(3),updated_at timestamptz,version bigint);
    create table finance.repair(id text primary key,scope_id text,statement_id text,status text,source_journal_id text,source_reversal_journal_id text,replacement_journal_id text,rollback_journal_id text,updated_at timestamptz,version bigint);
    create table invoice.profile(id text primary key,owner_id text);
    create table invoice.request(id text primary key,profile_id text,settlement_id text,kind text,state text,amount_minor bigint,currency char(3),created_at timestamptz,version bigint);
    create table invoice.document(id text primary key,request_id text,external_id text,issued_at timestamptz);
    insert into finance.account values('account:one','mall:one','CASH','CNY');
    insert into finance.account values('account:foreign','mall:foreign','CASH','CNY');
    insert into finance.journal values('journal:one','mall:one','order','order:one','CNY','2026-09','posted','订单入账','2026-09-05T10:00:00Z',1);
    insert into finance.journal values('journal:foreign','mall:foreign','order','order:one','CNY','2026-09','posted','其他商城订单入账','2026-09-05T10:00:00Z',1);
    insert into finance.entry values('entry:one','journal:one','account:one','debit',100,'2026-09-05T10:00:00Z');
    insert into finance.entry values('entry:foreign','journal:foreign','account:foreign','debit',900,'2026-09-05T10:00:00Z');
    insert into finance.statement values('statement:one','mall:one','2026-09-01','2026-09-30','CNY',100,'final','object:one',repeat('a',64),'2026-09-05T10:01:00Z',1);
    insert into finance.reconciliation values('reconciliation:one','mall:one','supplier','partner:one','2026-09','statement:one',repeat('b',64),'approved',0,'2026-09-05T10:02:00Z',2);
    insert into finance.statementline values('statementline:one','reconciliation:one','mall:one','order:one');
    insert into finance.reconciliationitem values('reconciliationitem:one','reconciliation:one','statementline:one','mall:one','order:one');
    insert into finance.settlement values('settlement:one','mall:one','reconciliation:one','partner:one','2026-09',100,'CNY','paid','2026-09-05T10:03:00Z',null,'2026-09-05T10:02:30Z',3);
    insert into finance.withdrawal values('withdrawal:one','mall:one','settlement:one','provider:one','paid',100,'CNY','2026-09-05T10:04:00Z',2);
    insert into finance.repair values('repair:one','mall:one','statement:one','submitted','journal:one',null,null,null,'2026-09-05T10:05:00Z',1);
    insert into invoice.profile values('profile:one','mall:one');
    insert into invoice.request values('invoice:one','profile:one','settlement:one','original','issued',100,'CNY','2026-09-05T10:04:00Z',2);
    insert into invoice.document values('document:one','invoice:one','external:one','2026-09-05T10:05:00Z');
  `);
  return database;
}
