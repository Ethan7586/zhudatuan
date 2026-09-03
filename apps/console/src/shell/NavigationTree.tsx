import { Brand, NavigationIcon } from '@shop/design';
import type { ConsoleNavigationNode } from '../entity/session/ConsoleSession';
import { ShellIcon } from './ShellIcon';

export interface NavigationTreeProps {
  readonly active: string | undefined;
  readonly collapsed: boolean;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly nodes: readonly ConsoleNavigationNode[];
  readonly onNavigate: (route: string) => void;
  readonly onToggle: () => void;
}

export function NavigationTree({ active, collapsed, displayName, roleLabel, nodes, onNavigate, onToggle }: NavigationTreeProps) {
  const support = nodes.find(({ component }) => component === 'support');
  const primary = nodes.filter(({ component }) => component !== 'support');
  return (
    <aside className={`consolesidebar${collapsed ? ' iscollapsed' : ''}`} aria-label="主导航">
      <div className="sidebarbrand">
        <Brand variant="mark" inverse />
        <span className="sidebarbrandcopy">
          <strong>智慧翼</strong>
          <small>福利平台治理系统</small>
        </span>
        <button className="sidebartoggle" type="button" onClick={onToggle} aria-label={collapsed ? '展开导航' : '收起导航'} aria-expanded={!collapsed}>
          <ShellIcon name={collapsed ? 'chevron' : 'collapse'} />
        </button>
      </div>
      <div className="sidebarnavtitle">工作台工作流</div>
      <nav aria-label="工作台与治理系统" className="sidebarnavigation">
        {primary.map((node) => (
          <NavigationButton key={node.id} node={node} active={active} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
      {support === undefined ? null : (
        <nav aria-label="客服系统" className="sidebarnavigation sidebarsupport">
          <NavigationButton node={support} active={active} collapsed={collapsed} onNavigate={onNavigate} />
        </nav>
      )}
      <div className="sidebarprofile">
        <span className="sidebarprofileavatar" aria-hidden="true">
          {avatarLetter(displayName)}
        </span>
        <span className="sidebarprofilecopy">
          <strong>{displayName}</strong>
          <small>{roleLabel}</small>
        </span>
      </div>
    </aside>
  );
}

function NavigationButton({
  node,
  active,
  collapsed,
  onNavigate,
}: Readonly<{
  node: ConsoleNavigationNode;
  active: string | undefined;
  collapsed: boolean;
  onNavigate: (route: string) => void;
}>) {
  return (
    <button type="button" onClick={() => onNavigate(node.route)} aria-label={node.title} aria-current={node.component === active ? 'page' : undefined} title={collapsed ? node.title : undefined} disabled={node.disabled}>
      <NavigationIcon icon={node.icon} />
      <span className="sidebarlabel">{node.title}</span>
    </button>
  );
}

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}
