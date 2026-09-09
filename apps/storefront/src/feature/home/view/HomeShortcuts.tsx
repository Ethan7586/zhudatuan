import { Building2, CreditCard, Headphones, Ticket } from 'lucide-react';
import type { useHomeViewModel } from '../viewmodel/HomeViewModel';

const SHORTCUTS = Object.freeze([
  Object.freeze({ label: '企业专区', description: '查看全部商品', icon: Building2, tone: 'bg-brand-light text-brand', open: (viewmodel: ViewModel) => viewmodel.navigatePage('catalog') }),
  Object.freeze({ label: '福利账户', description: '余额与流水', icon: CreditCard, tone: 'bg-success-surface text-success-strong', open: (viewmodel: ViewModel) => viewmodel.openFeature('账户流水') }),
  Object.freeze({ label: '电子卡券', description: '激活与核销', icon: Ticket, tone: 'bg-warning-surface text-warning-strong', open: (viewmodel: ViewModel) => viewmodel.openFeature('电子卡券') }),
  Object.freeze({ label: '客服中心', description: '咨询与工单', icon: Headphones, tone: 'bg-danger-surface text-danger-strong', open: (viewmodel: ViewModel) => viewmodel.openFeature('客服中心') }),
]);

type ViewModel = ReturnType<typeof useHomeViewModel>;

export function HomeShortcuts({ viewmodel }: Readonly<{ viewmodel: ViewModel }>) {
  return (
    <nav aria-label="商城快捷入口" className="grid grid-cols-4 gap-1 rounded-3xl border border-edge bg-surface p-2 shadow-sm lg:hidden">
      {SHORTCUTS.map(({ label, description, icon: Icon, tone, open }) => (
        <button key={label} type="button" onClick={() => open(viewmodel)} className="flex min-h-[5.75rem] min-w-0 flex-col items-center justify-center rounded-2xl px-1 text-center hover:bg-subtle">
          <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tone}`}>
            <Icon size={19} aria-hidden="true" />
          </span>
          <b className="mt-1.5 block max-w-full truncate text-[11px]">{label}</b>
          <span className="mt-0.5 block max-w-full truncate text-[9px] text-muted">{description}</span>
        </button>
      ))}
    </nav>
  );
}
