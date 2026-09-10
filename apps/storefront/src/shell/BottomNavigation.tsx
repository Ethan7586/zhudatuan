import { Home, LayoutGrid, ReceiptText, UserRound } from 'lucide-react';
import { WingCodeIcon } from '@shop/design';
import type { ShellMobileAction } from './ShellNavigation';
import { shellPathActive } from './ShellNavigation';

const ICONS = Object.freeze({
  home: Home,
  catalog: LayoutGrid,
  membercode: WingCodeIcon,
  orders: ReceiptText,
  account: UserRound,
});

export function BottomNavigation({ actions, pathname, navigate }: Readonly<{ actions: readonly ShellMobileAction[]; pathname: string; navigate: (path: string) => void }>) {
  if (actions.length === 0) return null;
  return (
    <nav aria-label="移动端主要导航" className="fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-surface/98 px-[4px] pb-[max(6px,env(safe-area-inset-bottom))] pt-[4px] shadow-[0_-8px_28px_rgba(15,35,70,.08)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-[512px] items-end justify-around">
        {actions.map((action) => {
          const Icon = ICONS[action.kind];
          const active = shellPathActive(pathname, action.path);
          const featured = action.kind === 'membercode';
          return (
            <button
              type="button"
              key={action.id}
              aria-current={active ? 'page' : undefined}
              aria-label={action.kind === 'membercode' ? '打开会员码' : action.label}
              onClick={() => navigate(action.path)}
              className={`storefrontbottomaction group relative flex min-h-[64px] min-w-[56px] flex-1 flex-col items-center justify-end gap-[2px] rounded-[16px] px-[4px] pb-[2px] pt-[4px] font-bold ${active ? 'text-brand' : 'text-muted hover:text-content'}`}
            >
              <span
                className={`${featured ? '-mt-[20px] grid h-[48px] w-[48px] place-items-center rounded-[16px] bg-brand text-inverse shadow-[0_8px_22px_rgba(31,94,255,.28)]' : `grid h-[32px] w-[48px] place-items-center rounded-full ${active ? 'bg-brand-light' : ''}`}`}
              >
                <Icon size={featured ? 23 : 20} strokeWidth={active || featured ? 2.5 : 2} aria-hidden="true" />
              </span>
              <span className="flex h-[20px] max-w-full items-center justify-center whitespace-nowrap leading-[20px]">{action.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
