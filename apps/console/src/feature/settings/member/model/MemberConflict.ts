import type { Member } from './Member';

export interface MemberConflict {
  readonly title: string;
  readonly details: readonly string[];
  readonly member?: Member;
}

export function memberConflict(previous: Member, current: Member | undefined): MemberConflict {
  if (current === undefined) return Object.freeze({ title: '成员已被移出当前管理范围', details: Object.freeze(['系统没有把修改应用到其他成员，请关闭后重新选择。']) });
  const details = [`权限版本：第 ${previous.accessVersion} 版 → 第 ${current.accessVersion} 版`];
  if (previous.displayName !== current.displayName) details.push(`显示名称：${previous.displayName} → ${current.displayName}`);
  if (previous.membershipStatus !== current.membershipStatus) details.push(`成员状态：${previous.membershipStatus} → ${current.membershipStatus}`);
  if (previous.organizationId !== current.organizationId) details.push('所属范围已变化');
  return Object.freeze({ title: '成员权威状态已变化', details: Object.freeze(details), member: current });
}
