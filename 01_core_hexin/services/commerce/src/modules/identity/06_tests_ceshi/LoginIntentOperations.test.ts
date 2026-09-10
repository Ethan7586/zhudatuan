import { resolveNodeContextByHost } from '@shop/config/sfl-node-kernel';
import type { QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { SERVER_NODE_MANIFEST_REGISTRY } from '../../../bootstrap/ApiBootstrap';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { sessionTicketOperations } from '../05_interface_jieru/http/SessionTicketOperations';

describe('active cross-node login intent', () => {
  it('uses an authenticated source node and enters the target node own accounts domain', async () => {
    const query = vi.fn().mockResolvedValue(result([{
      target_realm_id: 'realm:hbbtzn:l1',
      target_accounts_host: 'accounts.hbbtzn.com',
      target_target: 'storefront',
      target_application: 'zdt-l1-verify',
      target_return_origin: 'https://hbbtzn.com',
    }]));

    const response = await action()(request({
      targetNodeId: 'node:hbbtzn:l1',
      targetSurface: 'consumer',
      targetApplication: 'zdt-l1-verify',
      targetAccountsHost: 'accounts.zhudatuan.com',
    }), { query });

    expect(response).toMatchObject({
      status: 201,
      body: {
        sourceNode: 'node:zhudatuan:l0',
        targetNode: 'node:hbbtzn:l1',
        targetRealm: 'realm:hbbtzn:l1',
        targetSurface: 'consumer',
        returnOrigin: 'https://hbbtzn.com',
        expiresIn: 300,
      },
    });
    const loginUrl = new URL(String((response.body as { loginUrl: string }).loginUrl));
    expect(loginUrl.origin).toBe('https://accounts.hbbtzn.com');
    expect(loginUrl.searchParams.get('target')).toBe('storefront');
    expect(loginUrl.searchParams.get('application')).toBe('zdt-l1-verify');
    expect(loginUrl.searchParams.get('login_intent')).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(loginUrl.href).not.toContain('zhudatuan.com');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('identity.issue_login_intent'), [
      expect.stringMatching(/^loginintent:[a-z0-9-]{36}$/),
      expect.stringMatching(/^[0-9a-f]{64}$/),
      'session:l0',
      'account:l0',
      'realm:l0',
      'node:hbbtzn:l1',
      'consumer',
      'zdt-l1-verify',
    ]);
  });

  it('rejects a same-node target before any intent can be issued', async () => {
    const query = vi.fn();
    await expect(action()(request({
      targetNodeId: 'node:zhudatuan:l0',
      targetSurface: 'admin',
    }), { query })).rejects.toThrow('LOGIN_INTENT_CROSS_NODE_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });

  it('cannot be issued by a bare unauthenticated target request', async () => {
    const query = vi.fn();
    const input = request({ targetNodeId: 'node:hbbtzn:l1', targetSurface: 'admin' });
    await expect(action()({ ...input, access: null }, { query })).rejects.toThrow('AUTHENTICATION_REQUIRED');
    expect(query).not.toHaveBeenCalled();
  });
});

function action() {
  const selected = sessionTicketOperations({} as never)['identity.loginintents.create'];
  if (typeof selected !== 'function') throw new Error('LOGIN_INTENT_ACTION_MISSING');
  return selected;
}

function request(body: Record<string, unknown>): OperationRequest {
  const nodeContext = resolveNodeContextByHost(SERVER_NODE_MANIFEST_REGISTRY, 'api.fufu.wang');
  const scope = { kind: 'platform' as const, id: 'organization-platform-root', path: [] };
  return {
    type: 'identity.loginintents.create',
    access: {
      actor: {
        id: 'principal:one',
        account: 'account:l0',
        realm: nodeContext.realm.ref,
        nodeContext,
        session: 'session:l0',
        membership: 'membership:l0',
        credentialVersion: 1,
        accessVersion: 1,
        target: 'console',
        assurance: { level: 1 },
      },
      membership: { id: 'membership:l0', active: true, accessVersion: 1, denies: [], grants: [] },
      scope,
      accessVersion: 1,
      capabilities: ['identity.loginintents.create'],
      assurance: { level: 1 },
      trace: 'trace:login-intent',
    },
    input: {
      path: {},
      query: {},
      headers: { host: 'api.fufu.wang' },
      body,
      rawBody: JSON.stringify(body),
      deadline: Date.now() + 1_000,
      signal: new AbortController().signal,
      idempotency: 'login-intent:one',
    },
  };
}

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
