import type { OperationAssurance, OperationId } from '@shop/contract';
import { operationPolicy } from '@shop/contract/policies';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';

export function canUseOperation(context: ConsoleContext, operation: OperationId): boolean {
  const definition = operationPolicy(operation);
  const scopes = definition.scopeKinds as readonly string[];
  return (
    context.session.capabilities.includes(definition.capability) &&
    (definition.permission === null || context.session.permissions.includes(definition.permission)) &&
    (scopes.includes(context.scope.kind) || scopes.includes('self') || scopes.includes('owner'))
  );
}

export function assertOperationAccess(context: ConsoleContext, operation: OperationId, proof?: string): void {
  const definition = operationPolicy(operation);
  if (!canUseOperation(context, operation)) throw new Error('OPERATION_ACCESS_DENIED');
  if (context.session.assurance.level < assuranceLevel(definition.assuranceLevel)) throw new Error('STEPUP_REQUIRED');
  if (definition.assuranceLevel === 'stepup' && definition.actionProof && !/^[A-Za-z0-9_-]{43,128}$/.test(proof ?? '')) throw new Error('ACTION_PROOF_REQUIRED');
}

export function requiredAssurance(operation: OperationId): number {
  return assuranceLevel(operationPolicy(operation).assuranceLevel);
}

function assuranceLevel(value: OperationAssurance): number {
  if (value === 'stepup') return 3;
  if (value === 'mfa') return 2;
  return value === 'session' ? 1 : 0;
}
