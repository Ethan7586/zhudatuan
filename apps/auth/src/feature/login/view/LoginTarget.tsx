import type { AuthTarget } from '@shop/config/client';
import { ChoiceButton } from '@shop/design';
import { Building2, LayoutDashboard, ShoppingBag, Smartphone, Store } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';

interface TargetOption {
  readonly value: AuthTarget;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof ShoppingBag;
}

const targets: readonly TargetOption[] = Object.freeze([
  { value: 'storefront', title: '员工商城', description: '选购福利与查询订单', icon: ShoppingBag },
  { value: 'console', title: '运营控制台', description: '管理商城与企业运营', icon: LayoutDashboard },
]);
const specialized: Readonly<Record<Exclude<AuthTarget, 'storefront' | 'console'>, TargetOption>> = Object.freeze({
  miniapp: Object.freeze({ value: 'miniapp', title: '微信小程序', description: '在微信中领取与选购福利', icon: Smartphone }),
  store: Object.freeze({ value: 'store', title: '门店工作台', description: '处理核销、履约与门店业务', icon: Store }),
  supplier: Object.freeze({ value: 'supplier', title: '供应链后台', description: '管理商品、库存与履约协作', icon: Building2 }),
});

export function LoginTarget({ target, focusTarget, busy, onTarget }: Readonly<{ target: AuthTarget; focusTarget?: AuthTarget; busy: boolean; onTarget: (target: AuthTarget) => void }>) {
  const controls = useRef(new Map<AuthTarget, HTMLButtonElement>());
  const options = target === 'storefront' || target === 'console' ? targets : Object.freeze([specialized[target], ...targets]);
  useEffect(() => {
    if (focusTarget === target) controls.current.get(target)?.focus();
  }, [focusTarget, target]);
  return (
    <fieldset className="authtargets">
      <legend>登录后进入</legend>
      <div role="radiogroup" aria-label="登录后进入">
        {options.map((item, index) => {
          const Icon = item.icon;
          const selected = target === item.value;
          return (
            <ChoiceButton
              ref={(control) => {
                if (control === null) controls.current.delete(item.value);
                else controls.current.set(item.value, control);
              }}
              key={item.value}
              kind="radio"
              selected={selected}
              disabled={busy}
              onChoose={() => onTarget(item.value)}
              onKeyDown={(event) => move(event, index, options, onTarget)}
              className="authtarget"
              data-selected={selected}
            >
              <span className="authtargeticon">
                <Icon aria-hidden="true" />
              </span>
              <span className="authtargetcopy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </ChoiceButton>
          );
        })}
      </div>
    </fieldset>
  );
}

function move(event: KeyboardEvent<HTMLButtonElement>, index: number, options: readonly TargetOption[], onTarget: (target: AuthTarget) => void): void {
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (index + 1) % options.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (index + options.length - 1) % options.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? options.length - 1
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  onTarget(options[next]!.value);
  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
}
