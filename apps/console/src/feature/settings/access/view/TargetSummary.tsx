import type { AccessMembership } from '../model/Access';
import { accountLabel } from '../AccessText';
import { TechnicalDetails } from './TechnicalDetails';

export function TargetSummary({ membership }: Readonly<{ membership: AccessMembership }>) {
  return (
    <section className="accesstarget">
      <span>目标账号</span>
      <strong>{membership.displayName}</strong>
      <span>{accountLabel(membership)}</span>
      <span>保存时系统会自动核对最新授权状态，避免覆盖其他管理员的修改。</span>
      <TechnicalDetails
        facts={[
          { label: '成员标识', value: <code>{membership.id}</code> },
          { label: '授权版本', value: `第 ${membership.accessVersion} 版` },
        ]}
      />
    </section>
  );
}
