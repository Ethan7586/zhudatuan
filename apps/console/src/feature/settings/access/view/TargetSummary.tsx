import type { AccessMembership } from '../model/Access';

export function TargetSummary({ membership }: Readonly<{ membership: AccessMembership }>) {
  return (
    <section className="accesstarget">
      <span>目标账号</span>
      <strong>{membership.displayName}</strong>
      <span>{accountLabel(membership)}</span>
      <span>当前权限版本：第 {membership.accessVersion} 版</span>
    </section>
  );
}

export function accountLabel(membership: AccessMembership): string {
  if (membership.employeeNo) return `员工号 ${membership.employeeNo}`;
  if (membership.mobileMasked && membership.mobileMasked !== '***') return `手机 ${membership.mobileMasked}`;
  return membership.client === 'storefront' ? '商城账号' : '控制台账号';
}
