import { Button } from '@shop/design';
import { ArrowRight, Building2, Info, ShieldCheck, Store } from 'lucide-react';
import type { Membership } from '../model/Membership';

export function MembershipList({
  memberships,
  busy,
  onSelect,
}: Readonly<{
  memberships: readonly Membership[];
  busy: boolean;
  onSelect: (membership: Membership) => void;
}>) {
  if (memberships.length === 0) return <p className="authempty">该账号当前没有可用的企业福利或运营身份，请联系企业管理员。</p>;
  return (
    <div className="membershiplist">
      <div className="membershipguide">
        <div className="membershipguideicon">
          <Info aria-hidden="true" />
        </div>
        <div>
          <strong>一次登录，按需进入</strong>
          <p>商城用于福利消费与订单；后台用于运营管理，仅展示你已经获得授权的工作台。</p>
        </div>
      </div>
      <div className="membershipchoices">
        {memberships.map((membership) => {
          const consoleTarget = membership.target === 'console';
          const initial = membership.organizationName.trim().slice(0, 1) || '福';
          return (
            <Button key={membership.id} isDisabled={busy} onPress={() => onSelect(membership)} className="membershipchoice" data-target={membership.target}>
              <span className="membershipidentity">
                <span className="membershiplogo" aria-hidden="true">
                  {membership.logoUrl ? <img src={membership.logoUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : initial}
                </span>
                <span className="membershipcopy">
                  <strong>{membership.organizationName}</strong>
                  <span className="membershiprole">
                    {consoleTarget ? <ShieldCheck aria-hidden="true" /> : <Store aria-hidden="true" />}
                    {membership.roleLabel} · {consoleTarget ? '运营后台' : '福利商城'}
                  </span>
                  <span className="membershipperson">
                    <Building2 aria-hidden="true" />
                    {membership.displayName}
                  </span>
                </span>
              </span>
              <ArrowRight className="membershiparrow" aria-hidden="true" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
