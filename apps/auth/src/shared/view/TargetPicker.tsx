import type { AuthTarget } from '@shop/config/client';
import { ChoiceButton } from '@shop/design';
import { Building2, Check, LayoutDashboard, ShoppingBag, Smartphone, Store } from 'lucide-react';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { targetTitle } from '../model/Target';
import { ChoiceIntro } from './ChoiceIntro';

interface TargetOption {
  readonly value: AuthTarget;
  readonly title: string;
  readonly description: string;
  readonly icon: typeof ShoppingBag;
}

const storefrontTarget: TargetOption = Object.freeze({ value: 'storefront', title: targetTitle('storefront'), description: '进入商城选福利、查订单', icon: ShoppingBag });
const consoleTarget: TargetOption = Object.freeze({ value: 'console', title: targetTitle('console'), description: '进入后台管理商城与企业', icon: LayoutDashboard });
const targets: readonly TargetOption[] = Object.freeze([storefrontTarget, consoleTarget]);
const specialized: Readonly<Record<Exclude<AuthTarget, 'storefront' | 'console'>, TargetOption>> = Object.freeze({
  miniapp: Object.freeze({ value: 'miniapp', title: targetTitle('miniapp'), description: '进入微信领取与选购福利', icon: Smartphone }),
  store: Object.freeze({ value: 'store', title: targetTitle('store'), description: '进入工作台处理核销与履约', icon: Store }),
  supplier: Object.freeze({ value: 'supplier', title: targetTitle('supplier'), description: '进入后台管理商品与库存', icon: Building2 }),
});
const supplierTargets: readonly TargetOption[] = Object.freeze([specialized.supplier, consoleTarget]);
const storeTargets: readonly TargetOption[] = Object.freeze([specialized.store, consoleTarget]);
const miniappTargets: readonly TargetOption[] = Object.freeze([specialized.miniapp, ...targets]);

export function TargetPicker({
  target,
  entryTarget,
  focusTarget,
  busy,
  description = '登录成功后将直接进入所选系统。',
  onTarget,
}: Readonly<{ target: AuthTarget; entryTarget?: AuthTarget; focusTarget?: AuthTarget; busy: boolean; description?: string; onTarget: (target: AuthTarget) => void }>) {
  const controls = useRef(new Map<AuthTarget, HTMLButtonElement>());
  const titleId = useId();
  const descriptionId = useId();
  const options = targetOptions(entryTarget ?? target);
  useEffect(() => {
    if (focusTarget === target) controls.current.get(target)?.focus();
  }, [focusTarget, target]);
  return (
    <fieldset className="authtargets">
      <legend className="sr-only">目标系统</legend>
      <ChoiceIntro step={1} title="目标系统" description={description} titleId={titleId} descriptionId={descriptionId} />
      <div role="radiogroup" aria-labelledby={titleId} aria-describedby={descriptionId}>
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
              <span className="authtargetstate" aria-hidden="true">
                <Check />
              </span>
            </ChoiceButton>
          );
        })}
      </div>
    </fieldset>
  );
}

function targetOptions(entryTarget: AuthTarget): readonly TargetOption[] {
  if (entryTarget === 'supplier' || entryTarget === 'store') return entryTarget === 'supplier' ? supplierTargets : storeTargets;
  if (entryTarget === 'miniapp') return miniappTargets;
  return targets;
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
