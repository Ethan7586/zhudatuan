import type { AuthTarget } from '@shop/config/client';
import { LayoutDashboard, ShoppingBag } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';

const targets: readonly Readonly<{ value: AuthTarget; title: string; description: string; icon: typeof ShoppingBag }>[] = Object.freeze([
  { value: 'storefront', title: '员工商城', description: '选购福利与查询订单', icon: ShoppingBag },
  { value: 'console', title: '运营控制台', description: '管理商城与企业运营', icon: LayoutDashboard },
]);

export function LoginTarget({ target, focusTarget, busy, onTarget }: Readonly<{ target: AuthTarget; focusTarget?: AuthTarget; busy: boolean; onTarget: (target: AuthTarget) => void }>) {
  const controls = useRef(new Map<AuthTarget, HTMLButtonElement>());
  useEffect(() => {
    if (focusTarget === target) controls.current.get(target)?.focus();
  }, [focusTarget, target]);
  return (
    <fieldset className="authtargets">
      <legend>登录后进入</legend>
      <div role="radiogroup" aria-label="登录后进入">
        {targets.map((item, index) => {
          const Icon = item.icon;
          const selected = target === item.value;
          return (
            <button
              ref={(control) => {
                if (control === null) controls.current.delete(item.value);
                else controls.current.set(item.value, control);
              }}
              key={item.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={busy}
              onClick={() => onTarget(item.value)}
              onKeyDown={(event) => move(event, index, onTarget)}
              tabIndex={selected ? 0 : -1}
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
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function move(event: KeyboardEvent<HTMLButtonElement>, index: number, onTarget: (target: AuthTarget) => void): void {
  const next =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? (index + 1) % targets.length
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? (index + targets.length - 1) % targets.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? targets.length - 1
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  onTarget(targets[next]!.value);
  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
}
