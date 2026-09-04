import type { ConsoleContext } from '../../../entity/session/ConsoleSession';

export function assertVoucherAccess(context: ConsoleContext, permission: string, capability: string, critical = false, proof?: string): void {
  if (!context.session.permissions.includes(permission) || !context.session.capabilities.includes(capability)) throw new Error('当前账号没有执行这项卡券操作的权限。');
  if (context.session.csrf === undefined) throw new Error('安全会话已过期，请重新登录。');
  if (context.session.assurance.level < (critical ? 3 : 2)) throw new Error('STEPUP_REQUIRED');
  if (critical && !/^[A-Za-z0-9_-]{43,128}$/.test(proof ?? '')) throw new Error('ACTION_PROOF_REQUIRED');
}

export function positiveInteger(value: number, field: string, maximum = 100_000): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error(`${field}必须是 1–${maximum} 的整数。`);
  return value;
}

export function auditReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 4 || reason.length > 1000) throw new Error('操作原因须为 4–1000 个字符。');
  return reason;
}
