import type { OperationId } from '@shop/contract';
import type { HandlerContext } from '../pipeline/HandlerContext';
import type { ReadTransactionContext } from '../platform/database/TransactionContext';

export function readHandlerContext<TKey extends OperationId>(operation: TKey, transaction: ReadTransactionContext, scope = 'mall:one'): HandlerContext<TKey> {
  return {
    requestId: 'request:test',
    traceId: 'trace:test',
    deadline: Date.now() + 5_000,
    signal: new AbortController().signal,
    operation,
    headers: {},
    rawBody: '',
    transaction,
    security: {
      kind: 'session',
      access: {
        actor: { id: 'principal:test', session: 'session:test', membership: 'membership:test', credentialVersion: 1, accessVersion: 1, target: 'console', assurance: { level: 3 } },
        membership: { id: 'membership:test', active: true, accessVersion: 1, permissions: { allows: new Set(), denies: new Set() }, scopes: [] },
        roles: [],
        organization: scope,
        scope: { id: scope, kind: 'mall', path: [] },
        accessVersion: 1,
        capabilities: new Set([operation]),
        capabilityVersion: 1,
        assurance: { level: 3 },
        trace: 'trace:test',
      },
    },
  };
}
