import { useNavigate } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { scopePath } from '../../shared/url/ScopePath';
import './access-workspace-tabs.css';

export type AccessWorkspaceSection = 'members' | 'roles' | 'invitations';

const tabs = Object.freeze([
  { id: 'members', label: '成员' },
  { id: 'roles', label: '身份与权限' },
  { id: 'invitations', label: '邀请记录' },
] as const);

export function AccessWorkspaceTabs({ current }: Readonly<{ current: AccessWorkspaceSection }>) {
  const context = useConsoleContext();
  const navigate = useNavigate();
  return (
    <nav className="accessworkspacetabs" aria-label="会员与权限工作台">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-current={current === tab.id ? 'page' : undefined}
          onClick={() => {
            const target = tab.id === 'members'
              ? scopePath(context.scope, 'settings/members')
              : `${scopePath(context.scope, 'settings/access')}${tab.id === 'invitations' ? '?section=invitations' : ''}`;
            void navigate(target);
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
