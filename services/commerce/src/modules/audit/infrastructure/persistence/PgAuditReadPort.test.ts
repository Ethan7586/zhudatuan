import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { result, withReadTransaction } from '../../../../test/TransactionFixture';
import { PgAuditReadPort } from './PgAuditReadPort';

describe('generic audit reference query', () => {
  it('finds immutable evidence by object, subject or trace without an Order/Finance special case', async () => {
    const database = new PGlite();
    try {
      await database.exec(`
        create schema audit;
        create function audit.scope_allowed(text) returns boolean language sql stable as $$ select true $$;
        create table audit.record(
          id text primary key,scope_id text,operation text,subject_type text,subject_id text,object_type text,object_id text,
          actor_id text,actor_type text,request_id text,outcome text,reason text,before_hash text,after_hash text,
          previous_hash text,record_hash text,evidence jsonb,recorded_at timestamptz,trace_id text
        );
        create table audit.accessrecord(
          id text primary key,scope_id text,operation text,subject_type text,subject_id text,object_type text,object_id text,
          actor_id text,actor_type text,request_id text,outcome text,reason text,previous_hash text,record_hash text,
          fields jsonb,accessed_at timestamptz,trace_id text
        );
        insert into audit.record values(
          'audit:one','mall:one','finance.post','member','member:one','journal','journal:one','member:one','console',
          'request:one','succeeded','http:200',null,repeat('a',64),null,repeat('b',64),'{}','2026-09-05T10:00:00Z','trace:one'
        );
      `);
      const query = async (sql: string, values?: readonly unknown[]) => {
        const response = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
        return { ...result(response.rows), rowCount: response.affectedRows ?? response.rows.length };
      };
      const port = new PgAuditReadPort();
      const records = await withReadTransaction(query, (context) =>
        port.records(context, {
          scopes: ['mall:one'],
          references: [
            { kind: 'object', type: 'journal', id: 'journal:one' },
            { kind: 'subject', id: 'member:one' },
          ],
        })
      );
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({ id: 'audit:one', operation: 'finance.post', object: { type: 'journal', id: 'journal:one' }, subject: { type: 'member', id: 'member:one' }, trace: 'trace:one' });
      await expect(withReadTransaction(query, (context) => port.records(context, { scopes: ['mall:one'], references: [{ kind: 'object', id: 'bad id' }] }))).rejects.toThrow('AUDIT_REFERENCE_QUERY_INVALID');
    } finally {
      await database.close();
    }
  });
});
