import { Button } from '@shop/design';
import { LogIn, UserRoundPlus } from 'lucide-react';

const COPY = Object.freeze({
  register: Object.freeze({
    title: '还没有账号？',
    description: '使用企业邀请码注册，系统会按邀请确定可进入的系统与权限。',
    action: '开始注册',
    icon: UserRoundPlus,
  }),
  login: Object.freeze({
    title: '已经有账号？',
    description: '无需重复注册，直接使用已有账号安全登录。',
    action: '返回登录',
    icon: LogIn,
  }),
});

export function AuthSwitch({ destination, busy = false, onSwitch }: Readonly<{ destination: keyof typeof COPY; busy?: boolean; onSwitch: () => void }>) {
  const copy = COPY[destination];
  const Icon = copy.icon;
  return (
    <aside className="authswitch" aria-label={copy.title}>
      <span className="authswitchcopy">
        <strong>{copy.title}</strong>
        <small>{copy.description}</small>
      </span>
      <Button type="button" tone="quiet" className="authswitchbutton" isDisabled={busy} onPress={onSwitch}>
        <Icon aria-hidden="true" />
        {copy.action}
      </Button>
    </aside>
  );
}
