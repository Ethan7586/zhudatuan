import type { OperationId } from '@shop/contract';
import { operationPolicy } from '@shop/contract/policies';

export interface ReferralAccessContext {
  readonly scope: Readonly<{ kind: string }>;
  readonly session: Readonly<{ permissions: readonly string[]; capabilities: readonly string[] }>;
}

export interface ReferralAccessDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export function decideReferralAccess(context: ReferralAccessContext, operation: OperationId): ReferralAccessDecision {
  if (context.scope.kind !== 'mall') return Object.freeze({ allowed: false, reason: '分销返佣仅在商城范围可用，请先切换到具体商城。' });
  const definition = operationPolicy(operation);
  if (definition.permission !== null && !context.session.permissions.includes(definition.permission)) {
    return Object.freeze({ allowed: false, reason: `当前会话缺少 ${definition.permission} 权限。` });
  }
  if (!context.session.capabilities.includes(definition.capability)) {
    return Object.freeze({ allowed: false, reason: `当前会话缺少 ${definition.capability} 能力。` });
  }
  return Object.freeze({ allowed: true });
}
