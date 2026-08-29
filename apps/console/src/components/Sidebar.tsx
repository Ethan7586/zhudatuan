import { Brand } from '@shop/design';
import type { NavigationItem } from '../entity/navigation/ConsoleNavigation';
import { ShellIcon } from './ShellIcon';

export interface SidebarProps {
  readonly active: string | undefined;
  readonly collapsed: boolean;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly mainItems: readonly NavigationItem[];
  readonly bottomItems: readonly NavigationItem[];
  readonly onNavigate: (suffix: string) => void;
  readonly onToggle: () => void;
}

export function Sidebar({ active, collapsed, displayName, roleLabel, mainItems, bottomItems, onNavigate, onToggle }: SidebarProps) {

const navigationTargets: readonly NavigationTarget[] = Object.freeze([
  { key: 'cockpit', activeKey: 'cockpit', label: '经营驾驶舱', icon: 'trend', source: 'workstation' },
  { key: 'control', activeKey: 'control', label: '智慧翼中控台', icon: 'control', source: 'workstation' },
  { key: 'applications', activeKey: 'applications', label: '築店 · 商城与应用', icon: 'building', source: 'professional' },
  { key: 'products', activeKey: 'products', label: '商品治理台', icon: 'products', source: 'workstation' },
  { key: 'orders', activeKey: 'orders', label: '订单管理系统', icon: 'orders', source: 'workstation' },
  { key: 'referralsettings', activeKey: 'referral', label: '分销返佣系统', icon: 'channel', source: 'professional' },
  { key: 'channels', activeKey: 'channels', label: '渠道接入系统', icon: 'channel', source: 'professional' },
  { key: 'vouchers', activeKey: 'vouchers', label: '卡券治理台', icon: 'voucher', source: 'professional' },
  { key: 'finance', activeKey: 'finance', label: '财务与对账台', icon: 'finance', source: 'workstation' },
  { key: 'access', activeKey: 'access', label: '会员与权限', icon: 'members', source: 'professional' },
  { key: 'qualification', activeKey: 'qualification', label: '系统治理台', icon: 'system', source: 'professional' },
]);

export function Sidebar({ active, collapsed, displayName, roleLabel, scopeKind, professionalRoutes, workstations, onNavigate, onToggle }: SidebarProps) {
  return (
    <aside className={`consolesidebar${collapsed ? ' iscollapsed' : ''}`} aria-label="主导航">
      <div className="sidebarbrand">
        <Brand variant="mark" inverse />
        <span className="sidebarbrandcopy"><strong>主打团 ZHUDATUAN</strong><small>福利平台治理系统</small></span>
        <button className="sidebartoggle" type="button" onClick={onToggle}
          aria-label={collapsed ? '展开导航' : '收起导航'} aria-expanded={!collapsed}>
          <ShellIcon name={collapsed ? 'chevron' : 'collapse'} />
        </button>
      </div>
      <div className="sidebarnavtitle">工作台工作流</div>
      <nav aria-label="工作台与治理系统" className="sidebarnavigation">
        {mainItems.map((item) => {
          const label = navigationLabel(item);
          return <button key={item.moduleId} type="button" onClick={() => onNavigate(item.suffix)} data-status={item.status}
            aria-disabled={item.status === 'disabled' ? true : undefined}
            aria-label={label} aria-current={item.moduleId === active ? 'page' : undefined}
            title={collapsed ? label : undefined}>
            <ShellIcon name={item.icon} /><span className="sidebarlabel">{label}</span>
          </button>;
        })}
      </nav>
      <div className="sidebarprofile">
        <span className="sidebarprofileavatar" aria-hidden="true">{avatarLetter(displayName)}</span>
        <span className="sidebarprofilecopy"><strong>{displayName}</strong><small>{roleLabel}</small></span>
      </div>
      {bottomItems.map((item) => {
        const label = navigationLabel(item);
        return <nav key={item.moduleId} aria-label={label} className="sidebarsupport">
          <button type="button" onClick={() => onNavigate(item.suffix)} data-status={item.status}
            aria-disabled={item.status === 'disabled' ? true : undefined} aria-label={label}
            aria-current={item.moduleId === active ? 'page' : undefined} title={collapsed ? label : undefined}>
            <ShellIcon name={item.icon} /><span className="sidebarlabel">{label}</span>
          </button>
        </nav>;
      })}
    </aside>
  );
}

function navigationLabel(item: NavigationItem): string {
  return item.status === 'disabled' ? `${item.label}（已停用）` : item.label;
}

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}
