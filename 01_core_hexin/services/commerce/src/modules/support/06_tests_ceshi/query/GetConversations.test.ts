import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase, OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { SupportPortFactory } from '../../01_public_gongkai/SupportPort';
import { getConversationsOperations } from '../../03_application_yingyong/query/GetConversations';

describe('support conversation queries', () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec(`
      create schema support; create schema organization;
      create table organization.unitclosure(ancestor_id text,descendant_id text);
      create table support.conversation(id text primary key,member_id text,order_id text,channel text,subject text,
        reference_type text,reference_id text,updated_at timestamptz);
      create table support.ticket(id text primary key,conversation_id text,scope_id text,priority text,skill text,state text,
        assigned_agent_id text,response_due_at timestamptz,resolution_due_at timestamptz,created_at timestamptz,updated_at timestamptz,version bigint);
      create table support.message(id text primary key,conversation_id text,author_type text,author_id text,body_ciphertext text,created_at timestamptz);
      create table support.evidence(id text,conversation_id text,object_ref text,sha256 text,kind text,size_bytes bigint,state text,created_at timestamptz);
      insert into organization.unitclosure values('platform:root','platform:root');
      insert into support.conversation values('conversation:one','member:one',null,'inapp','测试会话',null,null,'2026-08-30T10:00:00Z');
      insert into support.ticket values('case:one','conversation:one','platform:root','normal','general','open',null,null,null,
        '2026-08-30T08:00:00Z','2026-08-30T10:00:00Z',3);
      insert into support.message values
        ('message:1','conversation:one','member','member:one','ciphertext-message-1','2026-08-30T08:00:00Z'),
        ('message:2','conversation:one','agent','agent:one','ciphertext-message-2','2026-08-30T09:00:00Z'),
        ('message:3','conversation:one','member','member:one','ciphertext-message-3','2026-08-30T10:00:00Z');
    `);
  });

  afterEach(async () => database.close());

  it('returns the newest page in chronological display order and pages toward older history', async () => {
    const lifecycle = messagesLifecycle();
    const first = await lifecycle.execute(request(), database as unknown as OperationDatabase, undefined);
    const finalized = await lifecycle.finalize!(request(), first, undefined);
    expect((finalized.body as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(['message:2', 'message:3']);
    const cursor = (finalized.body as { nextCursor: string }).nextCursor;

    const olderRequest = request(cursor);
    const older = await lifecycle.finalize!(olderRequest,
      await lifecycle.execute(olderRequest, database as unknown as OperationDatabase, undefined), undefined);
    expect((older.body as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(['message:1']);
    expect(older.body).not.toHaveProperty('nextCursor');
  });
});

function messagesLifecycle(): OperationLifecycle {
  const kms = { decrypt: async (_key: string, ciphertext: string) => `plain:${ciphertext}` } as unknown as KmsClient;
  const ports = (() => ({ member: async () => 'member:one' })) as unknown as SupportPortFactory;
  const action = getConversationsOperations(kms, ports)['support.messages.read'];
  if (!action || typeof action === 'function') throw new Error('SUPPORT_MESSAGES_LIFECYCLE_MISSING');
  return action;
}

function request(cursor?: string): OperationRequest {
  return { type: 'support.messages.read', access: { membership: { id: 'membership:one' }, scope: { id: 'platform:root' },
    actor: { id: 'agent:one' }, trace: 'trace:support' }, input: { path: { caseid: 'case:one' }, query: { limit: '2',
      ...(cursor === undefined ? {} : { cursor }) } } } as unknown as OperationRequest;
}
