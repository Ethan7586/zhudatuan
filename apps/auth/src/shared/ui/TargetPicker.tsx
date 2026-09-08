import type { AuthTarget } from '@shop/config/client';
import { CLIENT_BY_ID } from '@shop/config/clientcatalog';
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
  { value: 'storefront', title: title('storefront'), description: '选购福利与查询订单', icon: ShoppingBag },
  { value: 'console', title: title('console'), description: '管理商城与企业运营', icon: LayoutDashboard },
]);
const specialized: Readonly<Record<Exclude<AuthTarget, 'storefront' | 'console'>, TargetOption>> = Object.freeze({
  miniapp: Object.freeze({ value: 'miniapp', title: title('miniapp'), description: '在微信中领取与选购福利', icon: Smartphone }),
  store: Object.freeze({ value: 'store', title: title('store'), description: '处理核销、履约与门店业务', icon: Store }),
  supplier: Object.freeze({ value: 'supplier', title: title('supplier'), description: '管理商品、库存与履约协作', icon: Building2 }),
});

function title(target: AuthTarget): string {
  const client = CLIENT_BY_ID.get(target);
  if (!client) throw new Error(`AUTH_TARGET_MISSING:${target}`);
  return client.title;
}

export function TargetPicker({ label = '登录后进入', target, focusTarget, busy, onTarget }: Readonly<{ label?: string; target: AuthTarget; focusTarget?: AuthTarget; busy: boolean; onTarget: (target: AuthTarget) => void }>) {
  const controls = useRef(new Map<AuthTarget, HTMLButtonElement>());
  const options = target === 'storefront' || target === 'console' ? targets : Object.freeze([specialized[target], ...targets]);
  useEffect(() => {
    if (focusTarget === target) controls.current.get(target)?.focus();
  }, [focusTarget, target]);
  return (
    <fieldset className="authtargets">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
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
