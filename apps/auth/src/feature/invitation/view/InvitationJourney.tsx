import type { AuthTarget } from '@shop/config/client';
import { targetTitle } from '../../../shared/model/Target';
import type { InvitationMode } from '../model/Invitation';

const JOURNEYS = Object.freeze({
  unknown: Object.freeze({ steps: Object.freeze(['验证邀请', '识别用途', '身份确认', '进入系统']), description: '邀请码验证后，系统会自动识别注册或安全进入；无需提前判断。' }),
  enrollment: Object.freeze({ steps: Object.freeze(['验证邀请', '完善账号', '手机验证', '进入系统']), description: '企业、身份和固定员工权限均由系统确认，注册时不能自行扩大权限。' }),
  signin: Object.freeze({ steps: Object.freeze(['验证邀请', '确认成员', '安全验证', '进入系统']), description: '不会创建新账号或增加权限；只为指定成员签发一次安全会话。' }),
});

export function InvitationJourney({ target, current, mode }: Readonly<{ target: AuthTarget; current: 1 | 2 | 3 | 4; mode: InvitationMode }>) {
  const destination = targetTitle(target);
  const journey = JOURNEYS[mode];
  return (
    <section className="invitationjourney" aria-label="企业邀请处理进度">
      <ol>
        {journey.steps.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3 | 4;
          return (
            <li key={label} data-state={step < current ? 'complete' : step === current ? 'current' : 'pending'} aria-current={step === current ? 'step' : undefined}>
              <span>{step}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
      <p>
        {journey.description} 完成后进入“{destination}”。
      </p>
    </section>
  );
}
