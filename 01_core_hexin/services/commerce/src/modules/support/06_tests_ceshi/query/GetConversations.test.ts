import { PGlite } from '@electric-sql/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import type { OperationDatabase, OperationLifecycle } from '../../../../foundation/application/ModuleOperations';
import type { KmsClient } from '../../../../foundation/infrastructure/KmsClient';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
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
      create table support.agent(id text primary key,membership_id text);
      create table support.message(id text primary key,conversation_id text,author_type text,author_id text,visibility text default 'public',body_ciphertext text,created_at timestamptz);
      create table support.evidence(id text,conversation_id text,object_ref text,sha256 text,kind text,size_bytes bigint,state text,file_name text,
        visibility text default 'public',created_at timestamptz);
      create table support.history(ticket_id text,sequence bigint,kind text,actor_id text,evidence jsonb,occurred_at timestamptz,scope_id text);
      insert into organization.unitclosure values('platform:root','platform:root');
      insert into support.conversation values('conversation:one','member:one',null,'inapp','测试会话',null,null,'2026-08-30T10:00:00Z');
      insert into support.ticket values('case:one','conversation:one','platform:root','normal','general','open',null,null,null,
        '2026-08-30T08:00:00Z','2026-08-30T10:00:00Z',3);
      insert into support.message values
        ('message:1','conversation:one','member','member:one','public','ciphertext-message-1','2026-08-30T08:00:00Z'),
        ('message:2','conversation:one','agent','agent:one','public','ciphertext-message-2','2026-08-30T09:00:00Z'),
        ('message:3','conversation:one','member','member:one','public','ciphertext-message-3','2026-08-30T10:00:00Z');
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

  it('shows internal notes to console staff but never to the requester', async () => {
    await database.exec(`insert into support.message values
      ('message:internal','conversation:one','agent','agent:one','internal','ciphertext-internal','2026-08-30T10:30:00Z')`);
    const lifecycle = messagesLifecycle();

    const consoleResult = await lifecycle.finalize!(request(),
      await lifecycle.execute(request(), database as unknown as OperationDatabase, undefined), undefined);
    expect((consoleResult.body as { items: { id: string; visibility: string }[] }).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'message:internal', visibility: 'internal' })]));

    const requester = request(undefined, 'storefront');
    const requesterResult = await lifecycle.finalize!(requester,
      await lifecycle.execute(requester, database as unknown as OperationDatabase, undefined), undefined);
    expect((requesterResult.body as { items: { id: string }[] }).items.map(({ id }) => id)).not.toContain('message:internal');
  });

  it('does not expose another requester ticket or its attachments through a shared scope', async () => {
    await database.exec(`
      insert into support.conversation values('conversation:private','member:other',null,'inapp','其他人的工单',null,null,'2026-08-30T11:00:00Z');
      insert into support.ticket values('case:private','conversation:private','platform:root','normal','general','open',null,null,null,
        '2026-08-30T11:00:00Z','2026-08-30T11:00:00Z',1);
      insert into support.message values('message:private','conversation:private','member','member:other','public','secret','2026-08-30T11:00:00Z');
      insert into support.evidence values('evidence:private','conversation:private','oss://private','${'c'.repeat(64)}','image/png',100,'clean','private.png','public','2026-08-30T11:00:00Z');
    `);
    const lifecycle = messagesLifecycle();
    const otherTicket = request(undefined, 'storefront', 'case:private');

    const result = await lifecycle.finalize!(otherTicket,
      await lifecycle.execute(otherTicket, database as unknown as OperationDatabase, undefined), undefined);

    expect(result.body).toMatchObject({ items: [], attachments: [], count: 0 });
  });

  it('separates handling, review, created and scope-wide queues with stable counts', async () => {
    await database.exec(`
      insert into support.agent values('agent:mine','membership:one'),('agent:other','membership:other');
      insert into support.conversation values
        ('conversation:mine','member:two',null,'inapp','分配给我的',null,null,'2026-08-30T11:00:00Z'),
        ('conversation:other','member:three',null,'inapp','别人的工单',null,null,'2026-08-30T12:00:00Z');
      insert into support.ticket values
        ('case:mine','conversation:mine','platform:root','high','general','assigned','agent:mine',null,null,
          '2026-08-30T11:00:00Z','2026-08-30T11:00:00Z',1),
        ('case:other','conversation:other','platform:root','normal','general','assigned','agent:other',null,null,
          '2026-08-30T12:00:00Z','2026-08-30T12:00:00Z',1);
      insert into support.history values('case:mine',1,'priority.reviewed','actor:reviewer','{"priority":"high"}',
        '2026-08-30T11:05:00Z','platform:root');
    `);
    const action = casesAction();

    const handling = await action(caseRequest('handling'), database as unknown as OperationDatabase);
    const review = await action(caseRequest('review'), database as unknown as OperationDatabase);
    const created = await action(caseRequest('created'), database as unknown as OperationDatabase);
    const all = await action(caseRequest('all'), database as unknown as OperationDatabase);

    expect((handling.body as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(['case:mine', 'case:one']);
    expect((review.body as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(['case:other', 'case:one']);
    expect((created.body as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(['case:one']);
    expect((all.body as { items: { id: string }[] }).items.map(({ id }) => id)).toEqual(['case:other', 'case:mine', 'case:one']);
    expect((all.body as { views: unknown }).views).toEqual({ handling: 2, review: 2, created: 1, all: 3 });
  });

  it('enriches a linked order through the order module public query', async () => {
    await database.exec("update support.conversation set order_id='order:one' where id='conversation:one'");
    const order = async () => ({ id: 'order:one', scope: 'platform:root', member: 'member:one', number: 'SO-1001',
      state: 'active', paymentState: 'paid', fulfillmentState: 'shipped', totalMinor: 12900 });
    const action = getConversationsOperations({} as KmsClient,
      (() => ({ member: async () => 'member:one', order })) as unknown as SupportPortFactory)['support.cases.read'];
    if (typeof action !== 'function') throw new Error('SUPPORT_CASES_ACTION_MISSING');

    const result = await action(caseRequest('all'), database as unknown as OperationDatabase);

    expect((result.body as { items: unknown[] }).items).toEqual([expect.objectContaining({ order: expect.objectContaining({
      number: 'SO-1001', paymentState: 'paid', fulfillmentState: 'shipped', totalMinor: 12900,
    }) })]);
  });

  it('returns only clean attachments through a short-lived authorized URL', async () => {
    await database.exec(`insert into support.evidence values('evidence:one','conversation:one','object:one','${'a'.repeat(64)}',
      'image/png',256,'clean','proof.png','internal','2026-08-30T10:20:00Z')`);
    const objects = { authorize: async () => ({ url: 'https://objects.example/proof', expiresAt: '2026-09-16T00:05:00Z' }) };
    const lifecycle = messagesLifecycle(objects as unknown as ObjectStore);

    const result = await lifecycle.finalize!(request(),
      await lifecycle.execute(request(), database as unknown as OperationDatabase, undefined), undefined);

    expect((result.body as { attachments: unknown[] }).attachments).toEqual([expect.objectContaining({
      id: 'evidence:one', name: 'proof.png', contentType: 'image/png', visibility: 'internal', url: 'https://objects.example/proof', size: 256,
    })]);
    const requester = request(undefined, 'storefront');
    const requesterResult = await lifecycle.finalize!(requester,
      await lifecycle.execute(requester, database as unknown as OperationDatabase, undefined), undefined);
    expect((requesterResult.body as { attachments: unknown[] }).attachments).toEqual([]);
  });
});

function casesAction() {
  const action = getConversationsOperations({} as KmsClient,
    (() => ({ member: async () => 'member:one' })) as unknown as SupportPortFactory)['support.cases.read'];
  if (typeof action !== 'function') throw new Error('SUPPORT_CASES_ACTION_MISSING');
  return action;
}

function messagesLifecycle(objects?: ObjectStore): OperationLifecycle {
  const kms = { decrypt: async (_key: string, ciphertext: string) => `plain:${ciphertext}` } as unknown as KmsClient;
  const ports = (() => ({ member: async () => 'member:one' })) as unknown as SupportPortFactory;
  const action = getConversationsOperations(kms, ports, objects)['support.messages.read'];
  if (!action || typeof action === 'function') throw new Error('SUPPORT_MESSAGES_LIFECYCLE_MISSING');
  return action;
}

function request(cursor?: string, target: 'console' | 'storefront' = 'console', caseId = 'case:one'): OperationRequest {
  return { type: 'support.messages.read', access: { membership: { id: 'membership:one' }, scope: { id: 'platform:root' },
    actor: { id: 'agent:one', target }, trace: 'trace:support' }, input: { path: { caseid: caseId }, query: { limit: '2',
      ...(cursor === undefined ? {} : { cursor }) } } } as unknown as OperationRequest;
}

function caseRequest(view: 'handling' | 'review' | 'created' | 'all'): OperationRequest {
  return { type: 'support.cases.read', access: { membership: { id: 'membership:one' }, scope: { id: 'platform:root' },
    actor: { id: 'agent:one', target: 'console' }, trace: 'trace:support' }, input: { path: {}, query: { limit: '50', view } } } as unknown as OperationRequest;
}
