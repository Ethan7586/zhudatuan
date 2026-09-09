import { Brand, NavigationIcon } from '@shop/design';
import type { ConsoleNavigationNode } from '../entity/session/ConsoleSession';
import { SETTINGS_SECTIONS, settingsSectionForRoute } from '../shared/navigation/SettingsSection';
import { ShellIcon } from './ShellIcon';

export interface NavigationTreeProps {
  readonly active: string | undefined;
  readonly collapsed: boolean;
  readonly displayName: string;
  readonly roleLabel: string;
  readonly nodes: readonly ConsoleNavigationNode[];
  readonly onNavigate: (route: string) => void;
  readonly onDismiss: () => void;
  readonly onToggle: () => void;
}

export function NavigationTree({ active, collapsed, displayName, roleLabel, nodes, onNavigate, onDismiss, onToggle }: NavigationTreeProps) {
  const primary = nodes.filter((node) => node.experience.placement === 'primary');
  const secondary = nodes.filter((node) => node.experience.placement === 'secondary');
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
        <button className="sidebarmobileclose" type="button" onClick={onDismiss} aria-label="关闭主导航">
          <ShellIcon name="close" />
        </button>
      </div>
      <div className="sidebarnavtitle">工作台工作流</div>
      <nav aria-label="工作台与治理系统" className="sidebarnavigation">
        {primary.map((node) => (
          <NavigationBranch key={node.key} node={node} active={active} collapsed={collapsed} onNavigate={onNavigate} depth={0} />
        ))}
        {secondary.length === 0 ? null : <div className="sidebarnavtitle">增长与服务</div>}
        {secondary.map((node) => (
          <NavigationBranch key={node.key} node={node} active={active} collapsed={collapsed} onNavigate={onNavigate} depth={0} />
        ))}
      </nav>
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

function NavigationBranch({
  node,
  active,
  collapsed,
  onNavigate,
  depth,
}: Readonly<{
  node: ConsoleNavigationNode;
  active: string | undefined;
  collapsed: boolean;
  onNavigate: (route: string) => void;
  depth: number;
}>) {
  const experience = node.experience;
  const children = node.children.filter((child) => child.experience.placement !== 'contextual');
  const activeBranch = containsNavigation(node, active);
  const expanded = children.length > 0 && activeBranch && !collapsed && !experience.disabled;
  return (
    <div className="navigationbranch" data-depth={depth} data-active-branch={activeBranch || undefined}>
      <button
        type="button"
        onClick={() => onNavigate(experience.route)}
        aria-label={node.title}
        aria-current={node.key === active ? 'page' : undefined}
        aria-expanded={children.length === 0 ? undefined : expanded}
        title={collapsed ? node.title : (experience.disabledReason ?? undefined)}
        disabled={experience.disabled}
      >
        <NavigationIcon icon={experience.icon} />
        <span className="sidebarlabel">{node.title}</span>
        {experience.disabledReason === null ? null : <small className="sidebarnavavailability">{experience.disabledReason}</small>}
        {children.length === 0 ? null : (
          <span className="navigationdisclosure" aria-hidden="true">
            <ShellIcon name="chevron" />
          </span>
        )}
      </button>
      {!expanded ? null : (
        <div className="navigationchildren" role="group" aria-label={`${node.title}子导航`}>
          {experience.component === 'settings' ? (
            <SettingsNavigation children={children} active={active} collapsed={collapsed} onNavigate={onNavigate} depth={depth + 1} />
          ) : (
            children.map((child) => <NavigationBranch key={child.key} node={child} active={active} collapsed={collapsed} onNavigate={onNavigate} depth={depth + 1} />)
          )}
        </div>
      )}
    </div>
  );
}

function SettingsNavigation({
  children,
  active,
  collapsed,
  onNavigate,
  depth,
}: Readonly<{
  children: readonly ConsoleNavigationNode[];
  active: string | undefined;
  collapsed: boolean;
  onNavigate: (route: string) => void;
  depth: number;
}>) {
  const groupedKeys = new Set<string>();
  const groups = SETTINGS_SECTIONS.flatMap((section) => {
    const nodes = children.filter((child) => settingsSectionForRoute(child.experience.routeKey)?.id === section.id);
    for (const node of nodes) groupedKeys.add(node.key);
    return nodes.length === 0 ? [] : [Object.freeze({ section, nodes: Object.freeze(nodes) })];
  });
  const remaining = children.filter((child) => !groupedKeys.has(child.key));
  return (
    <>
      {groups.map(({ section, nodes }) => (
        <div className="navigationsection" role="group" aria-label={section.title} key={section.id}>
          <span className="navigationsectiontitle">{section.title}</span>
          {nodes.map((child) => (
            <NavigationBranch key={child.key} node={child} active={active} collapsed={collapsed} onNavigate={onNavigate} depth={depth} />
          ))}
        </div>
      ))}
      {remaining.map((child) => (
        <NavigationBranch key={child.key} node={child} active={active} collapsed={collapsed} onNavigate={onNavigate} depth={depth} />
      ))}
    </>
  );
}

function containsNavigation(node: ConsoleNavigationNode, active: string | undefined): boolean {
  return node.key === active || node.children.some((child) => containsNavigation(child, active));
}

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}
