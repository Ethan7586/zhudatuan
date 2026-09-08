import type { AuthTarget } from '@shop/config/client';
import { targetTitle } from '../../../shared/model/Target';

const STEPS = Object.freeze(['验证邀请', '完善账号', '确认身份', '进入系统']);

export function InvitationJourney({ target, current }: Readonly<{ target: AuthTarget; current: 1 | 2 | 3 | 4 }>) {
  const destination = targetTitle(target);
  return (
    <section className="invitationjourney" aria-label="邀请码注册进度">
      <ol>
        {STEPS.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3 | 4;
          return (
            <li key={label} data-state={step < current ? 'complete' : step === current ? 'current' : 'pending'} aria-current={step === current ? 'step' : undefined}>
              <span>{step}</span>
              <strong>{label}</strong>
            </li>
          );
        })}
      </ol>
      <p>企业、身份和权限由系统安全确认，注册后进入“{destination}”；注册过程不能自行扩大权限。</p>
    </section>
  );
}
