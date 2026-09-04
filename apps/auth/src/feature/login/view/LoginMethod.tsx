import { ChoiceButton } from '@shop/design';
import type { KeyboardEvent } from 'react';
import type { LoginMethod as Method } from '../../bootstrap';

const LABELS: Readonly<Record<Method, string>> = Object.freeze({ password: '密码登录', otp: '验证码登录', invitation: '邀请码登录' });

export function LoginMethod({ method, methods, busy, onChange }: Readonly<{ method: Method; methods: readonly string[]; busy: boolean; onChange: (method: Method) => void }>) {
  const available = (Object.keys(LABELS) as Method[]).filter((value) => methods.includes(value));
  return (
    <div className="authmethods" role="tablist" aria-label="登录方式">
      {available.map((value, index) => (
        <ChoiceButton
          id={`auth-tab-${value}`}
          aria-controls={`auth-panel-${value}`}
          key={value}
          kind="tab"
          selected={method === value}
          disabled={busy}
          onChoose={() => onChange(value)}
          onKeyDown={(event) => move(event, index, available, onChange)}
        >
          {LABELS[value]}
        </ChoiceButton>
      ))}
    </div>
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
