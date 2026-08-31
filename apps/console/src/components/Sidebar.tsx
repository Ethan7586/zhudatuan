import { Brand } from '@shop/design';
import type { ProfessionalRoute } from '../route/ProfessionalRouteCatalog';
import type { ConsoleScope } from '../entity/session/ConsoleSession';
import { applicationScopePresentation } from '../feature/application/ApplicationScope';
<<<<<<< HEAD
<<<<<<< HEAD
import { canAccessNavigationTarget } from '../route/NavigationAccess';
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
import { canAccessNavigationTarget } from '../route/NavigationAccess';
>>>>>>> 018b2a71 (chore(release): capture current production source)
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
<<<<<<< HEAD
<<<<<<< HEAD
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
>>>>>>> 018b2a71 (chore(release): capture current production source)
  readonly onNavigate: (suffix: string) => void;
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
<<<<<<< HEAD
<<<<<<< HEAD
  { key: 'reports', activeKey: 'reports', label: '数据报表', icon: 'trend', source: 'professional' },
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  { key: 'reports', activeKey: 'reports', label: '数据报表', icon: 'trend', source: 'professional' },
>>>>>>> 018b2a71 (chore(release): capture current production source)
  { key: 'control', activeKey: 'control', label: '智慧翼中控台', icon: 'control', source: 'workstation' },
  { key: 'applications', activeKey: 'applications', label: '築店 · 商城与应用', icon: 'building', source: 'professional' },
  { key: 'products', activeKey: 'products', label: '商品治理台', icon: 'products', source: 'workstation' },
  { key: 'orders', activeKey: 'orders', label: '订单管理系统', icon: 'orders', source: 'workstation' },
<<<<<<< HEAD
<<<<<<< HEAD
  { key: 'referralsettings', activeKey: 'referral', label: '分销返佣系统', icon: 'channel', source: 'professional' },
  { key: 'channels', activeKey: 'channels', label: '渠道接入系统', icon: 'channel', source: 'professional' },
=======
  { key: 'channels', activeKey: 'channels', label: '渠道与分销系统', icon: 'channel', source: 'professional' },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  { key: 'referralsettings', activeKey: 'referral', label: '分销返佣系统', icon: 'channel', source: 'professional' },
  { key: 'channels', activeKey: 'channels', label: '渠道接入系统', icon: 'channel', source: 'professional' },
>>>>>>> 018b2a71 (chore(release): capture current production source)
  { key: 'vouchers', activeKey: 'vouchers', label: '卡券治理台', icon: 'voucher', source: 'professional' },
  { key: 'finance', activeKey: 'finance', label: '财务与对账台', icon: 'finance', source: 'workstation' },
  { key: 'access', activeKey: 'access', label: '会员与权限', icon: 'members', source: 'professional' },
  { key: 'qualification', activeKey: 'qualification', label: '系统治理台', icon: 'system', source: 'professional' },
<<<<<<< HEAD
<<<<<<< HEAD
  { key: 'notification', activeKey: 'qualification', label: '通知管理', icon: 'bell', source: 'professional' },
]);

export function Sidebar({ active, collapsed, displayName, roleLabel, scopeKind, professionalRoutes, workstations, permissions, capabilities, onNavigate, onToggle }: SidebarProps) {
  const supportRoute = professionalRoutes.find(({ featureKey }) => featureKey === 'support');
  const supportAvailable = canAccessNavigationTarget('support', permissions, capabilities);
=======
]);

export function Sidebar({ active, collapsed, displayName, roleLabel, scopeKind, professionalRoutes, workstations, onNavigate, onToggle }: SidebarProps) {
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
  { key: 'notification', activeKey: 'qualification', label: '通知管理', icon: 'bell', source: 'professional' },
]);

export function Sidebar({ active, collapsed, displayName, roleLabel, scopeKind, professionalRoutes, workstations, permissions, capabilities, onNavigate, onToggle }: SidebarProps) {
  const supportRoute = professionalRoutes.find(({ featureKey }) => featureKey === 'support');
  const supportAvailable = canAccessNavigationTarget('support', permissions, capabilities);
>>>>>>> 018b2a71 (chore(release): capture current production source)
  return (
    <aside className={`consolesidebar${collapsed ? ' iscollapsed' : ''}`} aria-label="主导航">
      <div className="sidebarbrand">
        <Brand variant="mark" inverse />
        <span className="sidebarbrandcopy"><strong>智慧翼 Smart Wing</strong><small>福利平台治理系统</small></span>
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
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 018b2a71 (chore(release): capture current production source)
          const available = canAccessNavigationTarget(target.key, permissions, capabilities);
          return <button key={target.key} type="button" disabled={!available}
            onClick={available ? () => onNavigate(suffix) : undefined}
            aria-label={available ? label : `${label}，没有权限`} aria-disabled={!available}
            aria-current={available && target.activeKey === active ? 'page' : undefined}
            title={collapsed ? `${label}${available ? '' : ' · 没有权限'}` : undefined}>
<<<<<<< HEAD
            <ShellIcon name={target.icon} /><span className="sidebarlabel">{label}</span>
            {available ? null : <span className="sidebarnavavailability">没有权限</span>}
=======
          return <button key={target.key} type="button" onClick={() => onNavigate(suffix)}
            aria-label={label} aria-current={target.activeKey === active ? 'page' : undefined}
            title={collapsed ? label : undefined}>
            <ShellIcon name={target.icon} /><span className="sidebarlabel">{label}</span>
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
            <ShellIcon name={target.icon} /><span className="sidebarlabel">{label}</span>
            {available ? null : <span className="sidebarnavavailability">没有权限</span>}
>>>>>>> 018b2a71 (chore(release): capture current production source)
          </button>;
        })}
      </nav>
      <div className="sidebarprofile">
        <span className="sidebarprofileavatar" aria-hidden="true">{avatarLetter(displayName)}</span>
        <span className="sidebarprofilecopy"><strong>{displayName}</strong><small>{roleLabel}</small></span>
      </div>
<<<<<<< HEAD
      {supportRoute ? <nav aria-label="客服系统" className="sidebarsupport">
        <button type="button" disabled={!supportAvailable}
          onClick={supportAvailable ? () => onNavigate(supportRoute.suffix) : undefined}
          aria-label={supportAvailable ? '客服系统' : '客服系统，没有权限'} aria-disabled={!supportAvailable}
          aria-current={supportAvailable && active === 'support' ? 'page' : undefined}
          title={collapsed ? `客服系统${supportAvailable ? '' : ' · 没有权限'}` : undefined}>
          <ShellIcon name="support" /><span className="sidebarlabel">客服系统</span>
          {supportAvailable ? null : <span className="sidebarnavavailability">没有权限</span>}
        </button>
      </nav> : null}
=======
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    </aside>
  );
}

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}
