import { Brand } from '@shop/design';
import type { ProfessionalRoute } from '../route/ProfessionalRouteCatalog';
import type { ConsoleScope } from '../entity/session/ConsoleSession';
import { applicationScopePresentation } from '../feature/application/ApplicationScope';
import type { Workstation } from '../shell/Workstation';
import { ShellIcon, type ShellIconName } from './ShellIcon';

export interface SidebarProps {
  readonly active: string | undefined;
  readonly collapsed: boolean;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly scopeKind: ConsoleScope['kind'];
  readonly professionalRoutes: readonly ProfessionalRoute[];
  readonly workstations: readonly Workstation[];
  readonly onNavigate: (suffix: string) => void;
  readonly onOpenProfile: () => void;
  readonly onToggle: () => void;
}

interface NavigationTarget {
  readonly activeKey: string;
  readonly key: string;
  readonly label: string;
  readonly icon: ShellIconName;
  readonly source: 'professional' | 'workstation';
}

const navigationTargets: readonly NavigationTarget[] = Object.freeze([
  { key: 'cockpit', activeKey: 'cockpit', label: '经营驾驶舱', icon: 'trend', source: 'workstation' },
  { key: 'control', activeKey: 'control', label: '智慧翼中控台', icon: 'control', source: 'workstation' },
  { key: 'applications', activeKey: 'applications', label: '築店 · 商城与应用', icon: 'building', source: 'professional' },
  { key: 'products', activeKey: 'products', label: '商品治理台', icon: 'products', source: 'workstation' },
  { key: 'orders', activeKey: 'orders', label: '订单管理系统', icon: 'orders', source: 'workstation' },
  { key: 'channels', activeKey: 'channels', label: '渠道与分销系统', icon: 'channel', source: 'professional' },
  { key: 'vouchers', activeKey: 'vouchers', label: '卡券治理台', icon: 'voucher', source: 'professional' },
  { key: 'finance', activeKey: 'finance', label: '财务与对账台', icon: 'finance', source: 'workstation' },
  { key: 'access', activeKey: 'access', label: '会员与权限', icon: 'members', source: 'professional' },
  { key: 'qualification', activeKey: 'qualification', label: '系统治理台', icon: 'system', source: 'professional' },
]);

export function Sidebar({ active, collapsed, displayName, roleLabel, scopeKind, professionalRoutes, workstations, onNavigate, onToggle }: SidebarProps) {
  return (
    <aside className={`consolesidebar${collapsed ? ' iscollapsed' : ''}`} aria-label="主导航">
      <div className="sidebarbrand">
        <span className="sidebarproductmark" aria-hidden="true">F</span>
        <span className="sidebarbrandcopy"><strong>主打团</strong><small>经营与权限管理</small></span>
        <button className="sidebartoggle" type="button" onClick={onToggle}
          aria-label={collapsed ? '展开导航' : '收起导航'} aria-expanded={!collapsed}>
          <ShellIcon name={collapsed ? 'chevron' : 'collapse'} />
        </button>
      </div>
      <div className="sidebarnavtitle">工作台工作流</div>
      <nav aria-label="工作台与治理系统" className="sidebarnavigation">
        {navigationTargets.map((target) => {
          const label = target.key === 'applications' ? applicationScopePresentation(scopeKind).navigationLabel : target.label;
          const suffix = target.source === 'workstation'
            ? workstations.find(({ key }) => key === target.key)?.key
            : professionalRoutes.find(({ featureKey }) => featureKey === target.key)?.suffix;
          if (suffix === undefined) return null;
          return <button key={target.key} type="button" onClick={() => onNavigate(suffix)}
            aria-label={label} aria-current={target.activeKey === active ? 'page' : undefined}
            title={collapsed ? label : undefined}>
            <ShellIcon name={target.icon} /><span className="sidebarlabel">{label}</span>
          </button>;
        })}
      </nav>
      <button className="sidebarprofile" type="button" onClick={onOpenProfile}
        aria-label={`个人中心：${displayName}`} aria-current={active === 'profile' ? 'page' : undefined}
        title={collapsed ? '个人中心' : undefined}>
        <span className="sidebarprofileavatar" aria-hidden="true">{avatarLetter(displayName)}</span>
        <span className="sidebarprofilecopy"><strong>{displayName}</strong><small>{roleLabel}</small></span>
      </div>
    </aside>
  );
}

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}
