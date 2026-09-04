import type { AuthTarget } from '@shop/config/client';
import { CLIENT_BY_ID } from '@shop/config/clientcatalog';

const STEPS = Object.freeze(['校验邀请', '登录或注册', '确认身份和范围', '安全返回']);

export function InvitationJourney({ target, current }: Readonly<{ target: AuthTarget; current: 1 | 2 | 3 | 4 }>) {
  const targetTitle = CLIENT_BY_ID.get(target)?.title ?? '目标系统';
  return (
    <section className="invitationjourney" aria-label="接受邀请进度">
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
      <p>邀请身份和权限由服务端确认，目标范围为“{targetTitle}”；接受过程中不能自行扩大权限。</p>
    </section>
  );
}
