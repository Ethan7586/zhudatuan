export interface ReferralAccessContext {
  readonly scope: Readonly<{ kind: string }>;
  readonly session: Readonly<{
    permissions: readonly string[];
    capabilities: readonly string[];
  }>;
}

export interface ReferralAccessDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export function decideReferralAccess(context: ReferralAccessContext, permission: string, capability: string): ReferralAccessDecision {
  if (context.scope.kind !== 'mall') {
    return Object.freeze({ allowed: false, reason: '分销返佣仅在商城范围可用，请先切换到具体商城。' });
  }
  if (!context.session.permissions.includes(permission)) {
    return Object.freeze({ allowed: false, reason: `当前会话缺少 ${permission} 权限。` });
  }
  if (!context.session.capabilities.includes(capability)) {
    return Object.freeze({ allowed: false, reason: `当前会话缺少 ${capability} 能力。` });
  }
  return Object.freeze({ allowed: true });
}
