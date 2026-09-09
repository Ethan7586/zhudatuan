import { Button, Dialog, NavigationIcon } from '@shop/design';
import type { ReactNode } from 'react';
import type { InvitationCreateKind } from '../viewmodel/InvitationViewModel';

export function InvitationChoiceDialog({
  open,
  assurance,
  hasStorefronts,
  membershipsReady,
  membershipCount,
  onClose,
  onChoose,
  onVerify,
}: Readonly<{
  open: boolean;
  assurance: number;
  hasStorefronts: boolean;
  membershipsReady: boolean;
  membershipCount: number;
  onClose: () => void;
  onChoose: (kind: Exclude<InvitationCreateKind, 'choice'>) => void;
  onVerify: () => void;
}>) {
  const employeeReady = assurance >= 2 && hasStorefronts;
  const protectedReady = assurance >= 3;
  const signinReady = protectedReady && membershipsReady && membershipCount > 0;
  return (
    <Dialog open={open} title="新建邀请" eyebrow="统一邀请流程" description="先按接收人是否已有账号选择场景，后续只显示该场景需要填写的信息。" onClose={onClose}>
      <div className="invitationchooser">
        {assurance < 3 ? (
          <section className="invitationchoiceverify" aria-label="邀请安全验证">
            <div>
              <strong>{assurance < 2 ? '先验证身份，再选择邀请场景' : '指定员工注册已可用'}</strong>
              <span>{assurance < 2 ? '只需完成一次短信验证，三个邀请场景都会在这里开放。' : '如需共享注册或邀请现有成员，请先完成高强度验证。'}</span>
            </div>
            <Button tone="primary" onPress={onVerify}>
              完成身份验证
            </Button>
          </section>
        ) : null}
        <InvitationChoiceGroup icon="member" title="邀请新员工注册" description="接收人在统一邀请页验证手机号、设置密码，系统随后创建账号并授予固定商城身份。">
          <InvitationChoice
            title="指定员工注册"
            description="一人一码，预先绑定姓名和手机号，适合日常入职。"
            requirement={employeeReady ? '可以创建 · 需双因素验证' : employeeRequirement(assurance, hasStorefronts)}
            disabled={!employeeReady}
            onPress={() => onChoose('employee')}
          />
          <InvitationChoice
            title="共享员工注册"
            description="多人共用同一码，适合受控活动或集中入职。"
            requirement={protectedReady && hasStorefronts ? '可以创建 · 需高强度验证' : protectedRequirement(assurance, hasStorefronts)}
            disabled={!protectedReady || !hasStorefronts}
            onPress={() => onChoose('campaign')}
          />
        </InvitationChoiceGroup>
        <InvitationChoiceGroup icon="shield" title="邀请现有成员安全进入" description="只面向已有账号且在职的成员；不会注册账号，也不会新增登录方式或扩大权限。" secondary>
          <InvitationChoice
            title="指定成员安全访问"
            description="一人一码，通过一次性身份核验后进入指定系统。"
            requirement={signinReady ? '可以创建 · 需高强度验证' : signinRequirement(assurance, membershipsReady, membershipCount)}
            disabled={!signinReady}
            onPress={() => onChoose('signin')}
          />
        </InvitationChoiceGroup>
        <p className="invitationchoicenote">三种场景共用同一个邀请码入口、身份核验、权限校验和一次性回执；差异只在接收人是否需要注册。</p>
      </div>
    </Dialog>
  );
}

function InvitationChoiceGroup({ icon, title, description, secondary = false, children }: Readonly<{ icon: string; title: string; description: string; secondary?: boolean; children: ReactNode }>) {
  return (
    <section className="invitationchoicegroup" data-secondary={secondary || undefined}>
      <header>
        <span className="invitationchoiceicon">
          <NavigationIcon icon={icon} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </header>
      <div className="invitationchoicegrid">{children}</div>
    </section>
  );
}

function InvitationChoice({ title, description, requirement, disabled, onPress }: Readonly<{ title: string; description: string; requirement: string; disabled: boolean; onPress: () => void }>) {
  return (
    <Button className="invitationchoice" isDisabled={disabled} onPress={onPress}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
        <em>{requirement}</em>
      </span>
      <span className="invitationchoicearrow" aria-hidden="true">
        →
      </span>
    </Button>
  );
}

function employeeRequirement(assurance: number, hasStorefronts: boolean): string {
  if (!hasStorefronts) return '请先切换到包含商城的范围';
  return assurance < 2 ? '请先完成双因素验证' : '暂不可创建';
}

function protectedRequirement(assurance: number, hasStorefronts: boolean): string {
  if (!hasStorefronts) return '请先切换到包含商城的范围';
  return assurance < 3 ? '请先完成高强度验证' : '暂不可创建';
}

function signinRequirement(assurance: number, membershipsReady: boolean, membershipCount: number): string {
  if (assurance < 3) return '请先完成高强度验证';
  if (!membershipsReady) return '正在读取可选成员';
  return membershipCount === 0 ? '当前范围没有可邀请的在职成员' : '暂不可创建';
}
