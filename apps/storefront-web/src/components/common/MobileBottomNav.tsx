import React from 'react';
import { Home, Grid2X2, ClipboardList, User } from 'lucide-react';
import navigationTokens from '../../../../../packages/design-system/src/tokens.json';
import memberCodeSymbolAsset from '../../../../../packages/design-system/src/brand/wing-code-symbol.svg';
import type { PageRoute } from '../../context/MallContext';
import { useMall } from '../../context/MallContext';

const memberCodeSymbolUrl = typeof memberCodeSymbolAsset === 'string' ? memberCodeSymbolAsset : memberCodeSymbolAsset.src;

export const mobilePlatformFromUserAgent = (userAgent: string): 'android' | 'ios' => (/Android/i.test(userAgent) ? 'android' : 'ios');

export const MOBILE_NAVIGATION: Array<{
  key: string;
  page?: PageRoute;
  activePages: PageRoute[];
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  memberCode?: boolean;
}> = [
  { key: 'home', page: 'home', activePages: ['home'], label: navigationTokens.wingCode.navigation[0], icon: Home },
  { key: 'category', page: 'category', activePages: ['category', 'detail'], label: navigationTokens.wingCode.navigation[1], icon: Grid2X2 },
  { key: 'member-code', activePages: [], label: navigationTokens.wingCode.navigation[2], memberCode: true },
  { key: 'orders', page: 'orders', activePages: ['orders', 'order-detail', 'after-sale'], label: navigationTokens.wingCode.navigation[3], icon: ClipboardList },
  { key: 'profile', page: 'user-center', activePages: ['user-center', 'coupons', 'balance'], label: navigationTokens.wingCode.navigation[4], icon: User },
];

export const MobileBottomNav: React.FC = () => {
  const { currentPage, navigateTo, showToast } = useMall();

  React.useEffect(() => {
    document.documentElement.dataset.swMobilePlatform = mobilePlatformFromUserAgent(window.navigator.userAgent);
    return () => {
      delete document.documentElement.dataset.swMobilePlatform;
    };
  }, []);

  return (
    <nav aria-label="移动端主导航" className="fixed inset-x-0 bottom-0 z-50 hidden border-t border-[var(--sw-border)] bg-[var(--sw-surface)] pb-[env(safe-area-inset-bottom)] shadow-[var(--sw-shadow-overlay)] max-md:block">
      <div className="grid grid-cols-5" style={{ height: 'var(--sw-mobile-nav-height)' }}>
        {MOBILE_NAVIGATION.map((item) => {
          const Icon = item.icon;
          const active = item.activePages.includes(currentPage);
          if (item.memberCode) {
            return (
              <button
                key={item.key}
                type="button"
                aria-label={`${item.label}（功能接入中）`}
                onClick={() => showToast('会员码功能将在后续阶段接入', 'info')}
                className="relative flex min-h-[var(--sw-min-touch-target)] items-end justify-center text-xs leading-[var(--sw-line-height-caption)] text-[var(--sw-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sw-brand)]"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border border-[var(--sw-border-strong)] bg-[var(--sw-surface)]"
                  style={{
                    top: 'calc(var(--sw-wing-code-protrusion) * -1)',
                    width: 'var(--sw-wing-code-size)',
                    height: 'var(--sw-wing-code-size)',
                    boxShadow: 'var(--sw-wing-code-shadow)',
                  }}
                >
                  <img src={memberCodeSymbolUrl} alt="" className="h-1/2 w-1/2" />
                </span>
                <span>{item.label}</span>
              </button>
            );
          }
          return (
            <button
              key={item.key}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => item.page && navigateTo(item.page)}
              className={`relative flex min-h-[var(--sw-min-touch-target)] flex-col items-center justify-center gap-1 text-xs leading-[var(--sw-line-height-caption)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sw-brand)] ${active ? 'font-bold text-[var(--sw-brand)]' : 'text-[var(--sw-muted)]'}`}
            >
              {Icon && <Icon className="h-6 w-6" aria-hidden="true" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
