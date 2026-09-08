import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { operationSchema } from '@shop/contract';
import { PgTransactionAccess } from '../../../platform/database/PgTransactionAccess';
import { PgTransactionManager } from '../../../platform/database/PgTransactionManager';
import type { DatabasePool } from '../../../platform/database/Pool';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';
import type { AccessContext } from '../../../platform/security/AccessContext';
import { result } from '../../../test/TransactionFixture';
import { ApprovalApplication } from '../application/service/ApprovalApplication';
import { PgApprovalRepository } from '../infrastructure/persistence/PgApprovalRepository';

const read = (name: string) => readFileSync(new URL(`../../../../../../database/migrations/${name}.sql`, import.meta.url), 'utf8');
const base = read('20260904012000_prepare_approval');
const migration = read('20260904029200_enforce_approval_principals');
const gate = migration.slice(migration.indexOf('do $precondition$'), migration.indexOf('create function access.subject_principal'));
const guards = migration.slice(migration.indexOf('create function access.subject_principal'), migration.indexOf('select runtime.record_migration_evidence'));
const proofBase = read('20260830103000_enforce_maker_checker');
const proofIssue = read('20260830153000_issue_action_proof');
const proofConsume = read('20260830128000_complete_authorization_snapshot');
const members = { maker: 'principal:maker', makerother: 'principal:maker', checker: 'principal:checker', checkerother: 'principal:checker', second: 'principal:second' } as const;
type Member = keyof typeof members;

describe('principal-bound approval persistence', () => {
  it('freezes the requester account without exposing it in public DTOs and blocks self-decision after switching memberships', async () => {
    const data = await fixture();
    try {
      const current = await data.read();
      expect(current).not.toHaveProperty('requesterPrincipal');
      expect((await data.database.query('select requester_principal_id from approval.instances')).rows).toEqual([{ requester_principal_id: members.maker }]);
      await expect(data.approve('makerother')).rejects.toThrow('APPROVAL_SELF_DECISION_FORBIDDEN');
      expect((await data.read())?.decisions).toEqual([]);
      expect((await data.read())?.tasks[0]?.approvalCount).toBe(0);
    } finally {
      await data.database.close();
    }
  });

  it('counts a real account only once and requires a second account to reach a two-person quorum', async () => {
    const data = await fixture();
    try {
      const first = await data.approve('checker');
      expect(first.instance.state).toBe('pending');
      expect(first.task.approvalCount).toBe(1);
      await expect(data.approve('checkerother')).rejects.toThrow('APPROVAL_TASK_CONFLICT');
      const afterReplay = await data.read();
      expect(afterReplay?.decisions).toHaveLength(1);
      expect(afterReplay?.tasks[0]?.version).toBe(first.task.version);
      const completed = await data.approve('second');
      expect(completed.instance.state).toBe('approved');
      expect(completed.task.approvalCount).toBe(2);
      expect(completed.decision.proof).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(operationSchema('approval.tasks.approve').output.parse(completed)).toEqual(completed);
      await expect(data.approve('checker')).rejects.toThrow('APPROVAL_ALREADY_DECIDED');
      const proof = await data.consume(completed.decision.proof!);
      expect(proof?.checkerId).toBe('membership:second');
      expect(await data.consume(completed.decision.proof!)).toBeNull();
    } finally {
      await data.database.close();
    }
  });

  it('enforces the account boundary for direct SQL, forged principals, cross-scope subjects and immutable identities', async () => {
    const data = await fixture();
    try {
      const insert = `insert into approval.decisions(id,tenant_id,scope_id,instance_id,task_id,outcome,reason,actor_id,actor_principal_id,evidence,decided_at)
        select 'approvaldecision:forged','tenant:test',$1,instance_id,id,'approved','已复核',$2,$3,'{}',now() from approval.tasks limit 1`;
      await expect(data.database.query(insert, ['scope:test', 'membership:makerother', null])).rejects.toThrow('APPROVAL_SELF_DECISION_FORBIDDEN');
      await expect(data.database.query(insert, ['scope:test', 'membership:checker', members.second])).rejects.toThrow('AUTHORIZATION_DENIED');
      await expect(data.database.query(insert, ['scope:other', 'membership:checker', null])).rejects.toThrow('APPROVAL_DECISION_SUBJECT_INVALID');
      await expect(data.database.exec(`update access.membership set principal_id='principal:second' where id='membership:maker'`)).rejects.toThrow('MEMBERSHIP_PRINCIPAL_IMMUTABLE');
      await expect(data.database.exec(`delete from access.membership where id='membership:makerother'`)).rejects.toThrow('MEMBERSHIP_PRINCIPAL_IMMUTABLE');
      for (const assignment of ["requester_principal_id='principal:second'", 'amount_minor=9999', "scope_id='scope:other'"]) {
        await expect(data.database.exec(`update approval.instances set ${assignment}`)).rejects.toThrow('APPROVAL_INSTANCE_BINDING_IMMUTABLE');
      }
      expect((await data.read())?.decisions).toEqual([]);
    } finally {
      await data.database.close();
    }
  });

  it('rejects a forged transaction actor and an inactive checker even when application context claims assignment', async () => {
    const data = await fixture();
    try {
      await expect(data.approve('checker', { actor: members.second })).rejects.toThrow('AUTHORIZATION_DENIED');
      await data.database.exec(`update identity.principal set status='disabled' where id='principal:checker'`);
      await expect(data.approve('checker')).rejects.toThrow('AUTHORIZATION_DENIED');
      expect((await data.read())?.tasks[0]?.approvalCount).toBe(0);
    } finally {
      await data.database.close();
    }
  });

  it('rejects forged final proof bindings and rechecks the checker when a valid proof is consumed', async () => {
    const data = await fixture();
    try {
      await data.approve('checker');
      const completed = await data.approve('second');
      await expect(data.database.exec(`update approval.proofs set checker_id='membership:makerother'`)).rejects.toThrow('APPROVAL_SELF_DECISION_FORBIDDEN');
      await data.database.exec(`update identity.principal set status='disabled' where id='principal:second'`);
      await expect(data.consume(completed.decision.proof!)).rejects.toThrow('APPROVAL_PROOF_INVALID');
      expect((await data.database.query('select consumed_at from approval.proofs')).rows).toEqual([{ consumed_at: null }]);
    } finally {
      await data.database.close();
    }
  });

  it('does not authorize an inaccessible scope or a stale task version', async () => {
    const data = await fixture();
    try {
      await expect(data.approve('checker', { scope: 'scope:other' })).rejects.toThrow('RESOURCE_NOT_FOUND');
      await expect(data.approve('checker', { version: 0 })).rejects.toThrow('APPROVAL_TASK_CONFLICT');
      expect((await data.read())?.decisions).toEqual([]);
    } finally {
      await data.database.close();
    }
  });

  it('stops historical migration without guessing or deleting requester and decision evidence', async () => {
    const data = await fixture();
    try {
      await expect(data.database.exec(gate)).rejects.toThrow('APPROVAL_PRINCIPAL_EVIDENCE_REQUIRED');
      expect((await data.read())?.requesterId).toBe('membership:maker');
    } finally {
      await data.database.close();
    }
  });
});

describe('principal-bound action proofs', () => {
  it('rejects a historical same-account proof on consumption without erasing the old evidence', async () => {
    const data = await fixture(true);
    try {
      await expect(data.consumeAction()).rejects.toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
      expect((await data.database.query('select checker_membership_id,consumed_at from access.actionproof')).rows).toEqual([{ checker_membership_id: 'membership:makerother', consumed_at: null }]);
    } finally {
      await data.database.close();
    }
  });

  it('blocks same-account action proofs and step-up requests through database enforcement', async () => {
    const data = await fixture();
    try {
      await expect(data.issue('makerother')).rejects.toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
      await expect(
        data.database.exec(`insert into identity.stepuprequest(challenge_id,operation_id,resource_id,request_hash,expected_version,maker_membership_id,checker_membership_id,target,scope_id,checker_access_version,created_at)
        values('challenge:one','voucher.credentialexports.create','voucher:one',repeat('a',64),1,'membership:maker','membership:makerother','console','scope:test',1,now())`)
      ).rejects.toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
      expect((await data.database.query('select id from access.actionproof')).rows).toEqual([]);
    } finally {
      await data.database.close();
    }
  });

  it('issues and consumes one exact action only once and rejects inactive maker at consumption', async () => {
    const data = await fixture();
    try {
      await data.issue('checker');
      await data.database.exec(`update identity.principal set status='disabled' where id='principal:maker'`);
      await expect(data.consumeAction()).rejects.toThrow('MAKER_CHECKER_SEPARATION_REQUIRED');
      expect((await data.database.query('select consumed_at from access.actionproof')).rows).toEqual([{ consumed_at: null }]);
      await data.database.exec(`update identity.principal set status='active' where id='principal:maker'`);
      expect((await data.consumeAction()).rows).toEqual([{ proof_id: '00000000-0000-4000-8000-000000000001', checker_membership_id: 'membership:checker' }]);
      await expect(data.consumeAction()).rejects.toThrow('ACTION_PROOF_REPLAYED');
    } finally {
      await data.database.close();
    }
  });
});

async function fixture(legacyProof = false) {
  const database = new PGlite();
  await database.exec(`create role shopapp; create role shopjob; create schema approval; create schema access; create schema identity; create schema runtime; create schema capability;
    create table identity.principal(id text primary key,status text);
    create table identity.challenge(id text primary key); insert into identity.challenge values('challenge:one');
    create table access.membership(id text primary key,principal_id text references identity.principal(id),status text);
    create table access.permission(code text primary key); insert into access.permission values('voucher.credential.export');
    create table runtime.operation(id text primary key); insert into runtime.operation values('voucher.credentialexports.create');
    create table runtime.schemaversion(version text); insert into runtime.schemaversion values('20260904029100');
    create function access.scope_allowed(text) returns boolean language sql as $$ select $1=current_setting('app.scope_id',true) $$;
    ${base.slice(base.indexOf('create table approval.templates'), base.indexOf('insert into runtime.operation'))}
    ${proofBase.slice(proofBase.indexOf('create table access.actionproof'), proofBase.indexOf('alter table access.actionproof'))}
    ${proofIssue.slice(proofIssue.indexOf('create table identity.stepuprequest'), proofIssue.indexOf('create index identity_stepuprequest'))}
    insert into identity.principal values('principal:maker','active'),('principal:checker','active'),('principal:second','active');`);
  for (const [member, principal] of Object.entries(members)) await database.query("insert into access.membership values($1,$2,'active')", [`membership:${member}`, principal]);
  if (legacyProof)
    await database.exec(`insert into access.actionproof(id,token_hash,operation_id,resource_id,request_hash,expected_version,target,scope_id,
    maker_membership_id,checker_membership_id,checker_access_version,permission_code,expires_at)
    values('00000000-0000-4000-8000-000000000001',decode(repeat('12',32),'hex'),'voucher.credentialexports.create','voucher:one',repeat('a',64),1,
      'console','scope:test','membership:maker','membership:makerother',1,'voucher.credential.export',now()+interval '5 minutes')`);
  await database.exec(guards);
  // Authorization data is a controlled fixture; the real issue/consume SQL and all separation guards execute below.
  await database.exec(`create function access.authorization_snapshot(text,text,text,text)
    returns table(membership_id text,membership_active boolean,access_version bigint,permission_denies text[],permission_allows text[],operation_ids text[],resource_scope jsonb)
    language sql as $$ select $1,access.subject_principal($1,true) is not null,1::bigint,array[]::text[],array['voucher.credential.export'],array[$3],'{"id":"scope:test"}'::jsonb $$;
    ${proofIssue.slice(proofIssue.indexOf('create function access.issue_action_proof'), proofIssue.indexOf('revoke all on function access.issue_action_proof'))}
    ${proofConsume.slice(proofConsume.indexOf('create function access.consume_action_proof'), proofConsume.indexOf('revoke all on function access.authorization_snapshot'))}`);
  const query = async (sql: string, values?: readonly unknown[]) => {
    const response = await database.query<Record<string, unknown>>(sql, values ? [...values] : []);
    return { ...result(response.rows), rowCount: response.affectedRows ?? response.rows.length };
  };
  const client = { query, release: () => undefined } as unknown as PoolClient;
  const pool: DatabasePool = { connect: async () => client, query: query as DatabasePool['query'], workload: () => pool, end: async () => undefined };
  const manager = new PgTransactionManager(pool);
  const repository = new PgApprovalRepository(new PgTransactionAccess());
  const application = new ApprovalApplication(repository);
  const write = <T>(member: Member, work: (context: WriteTransactionContext) => Promise<T>, scope = 'scope:test', actor = members[member] as string) =>
    manager.write({ tenant: 'tenant:test', membership: `membership:${member}`, scope, actor, trace: 'trace:approval', operation: 'approval.tasks.approve', deadline: Date.now() + 10_000, signal: new AbortController().signal }, work);
  await write('maker', async (context) => {
    await repository.createTemplate(context, {
      id: 'approvaltemplate:one',
      scopeId: context.scope,
      code: 'voucher.issue',
      name: '发放双人审批',
      subjectKind: 'voucherissue',
      actorId: context.membership,
      expectedVersion: null,
      escalations: [],
      steps: [{ sequence: 1, name: '独立复核', dueHours: 4, approvers: [{ kind: 'permission', value: 'approval.task.decide', minimumApprovals: 2 }] }],
    });
    await repository.setTemplateState(context, { id: 'approvaltemplate:one', scopeId: context.scope, state: 'enabled', expectedVersion: 1, actorId: context.membership });
    await repository.createInstance(context, {
      id: 'approvalinstance:one',
      scopeId: context.scope,
      requesterId: context.membership,
      subjectKind: 'voucherissue',
      subjectId: 'issue:one',
      subjectVersion: 1,
      subjectSnapshot: { quantity: 1 },
      action: 'voucher.issueorders.issue',
      evidenceHash: 'a'.repeat(64),
      amountMinor: 1000,
      currency: 'CNY',
      constraints: {},
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
  });
  const readInstance = () => write('maker', (context) => repository.getInstance(context, context.scope, 'approvalinstance:one'));
  const approve = async (member: Member, options: { scope?: string; version?: number; actor?: string } = {}) => {
    const current = await readInstance();
    const task = current!.tasks[0]!;
    const expectedVersion = options.version ?? task.version;
    return write(
      member,
      (transaction) => {
        const access = { actor: { id: members[member] }, membership: { id: transaction.membership, permissions: { allows: new Set(['approval.task.decide']) } }, roles: [], scope: { id: transaction.scope } } as unknown as AccessContext;
        return application.decide(
          { path: { taskid: task.id }, body: { expectedVersion, reason: '已复核发放证据', evidence: {} } },
          {
            operation: 'approval.tasks.approve',
            requestId: 'request:one',
            traceId: transaction.trace,
            transaction,
            security: { kind: 'session', access },
            expectedVersion,
            headers: {},
            rawBody: '',
            deadline: transaction.deadline,
            signal: transaction.signal,
          },
          'approved'
        );
      },
      options.scope,
      options.actor
    );
  };
  const consume = (token: string) =>
    write('maker', (context) =>
      repository.consumeProof(context, {
        tokenHash: createHash('sha256').update(token).digest(),
        scopeId: context.scope,
        subjectKind: 'voucherissue',
        subjectId: 'issue:one',
        subjectVersion: 1,
        action: 'voucher.issueorders.issue',
        evidenceHash: 'a'.repeat(64),
        amountMinor: 1000,
        currency: 'CNY',
        constraints: {},
        consumerOperation: 'voucher.issueorders.issue',
        requestHash: 'b'.repeat(64),
        consumerId: context.membership,
      })
    );
  const issue = (member: Member) =>
    database.query(
      `select * from access.issue_action_proof('00000000-0000-4000-8000-000000000001',decode(repeat('12',32),'hex'),
    'voucher.credentialexports.create','voucher:one',repeat('a',64),1,'console','scope:test','membership:maker',$1,'voucher.credential.export')`,
      [`membership:${member}`]
    );
  const consumeAction = () =>
    database.query(`select * from access.consume_action_proof(decode(repeat('12',32),'hex'),'voucher.credentialexports.create',
    'voucher:one',repeat('a',64),1,'console','scope:test','membership:maker','voucher.credential.export')`);
  return { database, read: readInstance, approve, consume, issue, consumeAction };
}
