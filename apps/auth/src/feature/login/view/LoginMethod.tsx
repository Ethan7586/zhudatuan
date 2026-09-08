import { ChoiceButton } from '@shop/design';
import { LockKeyhole, MessageSquareText } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import type { LoginMethod as Method } from '../../bootstrap';
import { ChoiceIntro } from '../../../shared/view/ChoiceIntro';

const METHODS = Object.freeze({
  password: Object.freeze({ label: '密码登录', icon: LockKeyhole }),
  otp: Object.freeze({ label: '验证码登录', icon: MessageSquareText }),
}) satisfies Readonly<Record<Method, Readonly<{ label: string; icon: typeof LockKeyhole }>>>;

export function LoginMethod({ method, methods, busy, onChange }: Readonly<{ method: Method; methods: readonly string[]; busy: boolean; onChange: (method: Method) => void }>) {
  const available = (Object.keys(METHODS) as Method[]).filter((value) => methods.includes(value));
  const titleId = useId();
  const descriptionId = useId();
  return (
    <section className="authmethodsection">
      <ChoiceIntro step={2} title="登录方式" description="仅切换身份验证方式，不会改变上方所选系统。" titleId={titleId} descriptionId={descriptionId} />
      <div className="authmethods" role="tablist" aria-labelledby={titleId} aria-describedby={descriptionId}>
        {available.map((value, index) => {
          const item = METHODS[value];
          const Icon = item.icon;
          return (
            <ChoiceButton
              id={`auth-tab-${value}`}
              aria-controls={`auth-panel-${value}`}
              key={value}
              kind="tab"
              selected={method === value}
              disabled={busy}
              onChoose={() => onChange(value)}
              onKeyDown={(event) => move(event, index, available, onChange)}
              className="authmethod"
            >
              <Icon aria-hidden="true" />
              {item.label}
            </ChoiceButton>
          );
        })}
      </div>
    </section>
  );
}

function move(event: KeyboardEvent<HTMLButtonElement>, index: number, available: readonly Method[], onChange: (method: Method) => void): void {
  const last = available.length - 1;
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (index + 1) % available.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (index + last) % available.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? last
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  onChange(available[next]!);
  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
}
