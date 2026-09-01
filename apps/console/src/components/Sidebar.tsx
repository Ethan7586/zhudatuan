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
  readonly onOpenProfile: () => void;
  readonly onToggle: () => void;
}

export function Sidebar({ active, collapsed, displayName, roleLabel, mainItems, bottomItems, onNavigate, onOpenProfile, onToggle }: SidebarProps) {

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
      <button className="sidebarprofile" type="button" onClick={onOpenProfile}
        aria-label={`个人中心：${displayName}`} aria-current={active === 'profile' ? 'page' : undefined}
        title={collapsed ? '个人中心' : undefined}>
        <span className="sidebarprofileavatar" aria-hidden="true">{avatarLetter(displayName)}</span>
        <span className="sidebarprofilecopy"><strong>{displayName}</strong><small>个人中心 · {roleLabel}</small></span>
      </button>
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
