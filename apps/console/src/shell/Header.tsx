import { useEffect, useRef, useState } from 'react';
import { ShellIcon } from './ShellIcon';

export interface HeaderProps {
  readonly title: string;
  readonly summary: string;
  readonly scopeLabel: string;
  readonly displayName: string;
  readonly assuranceLevel: number;
  readonly syncedAt: string;
  readonly loggingOut: boolean;
  readonly logoutError?: string;
  readonly onStepup: () => void;
  readonly onLogout: () => void;
  readonly onOpenNavigation: () => void;
}

type HeaderPanel = 'account' | 'command' | 'notices' | 'tasks' | null;

export function Header(props: HeaderProps) {
  const { title, summary, scopeLabel, displayName, assuranceLevel, syncedAt, loggingOut, logoutError, onLogout, onStepup, onOpenNavigation } = props;
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const commandInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPanel('command');
      } else if (event.key === 'Escape') {
        setPanel(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (panel === 'command') commandInput.current?.focus();
  }, [panel]);

  const togglePanel = (next: Exclude<HeaderPanel, null>) => setPanel((current) => (current === next ? null : next));

  return (
    <header className="consoleheader">
      <div className="consolebreadcrumb" aria-label="当前位置">
        <button className="mobilemenubutton" type="button" onClick={onOpenNavigation} aria-label="打开主导航">
          <ShellIcon name="menu" />
        </button>
        <strong>{title}</strong>
        <i aria-hidden="true">/</i>
        <span className="consoleheadersummary">{summary}</span>
      </div>

      <div className="commandarea">
        <button className="commandtrigger" type="button" onClick={() => togglePanel('command')} aria-haspopup="dialog" aria-expanded={panel === 'command'}>
          <ShellIcon name="search" />
          <span>搜索工作台、任务或快捷命令…</span>
          <kbd>⌘ K</kbd>
        </button>
        {panel === 'command' ? (
          <div className="headerpopup commandpopup" role="dialog" aria-label="快捷命令">
            <label htmlFor="shellcommand">快捷搜索</label>
            <input ref={commandInput} id="shellcommand" type="search" placeholder="输入工作台、订单或任务…" />
            <p>{summary}</p>
            <button type="button" onClick={() => setPanel(null)}>
              打开「{title}」
            </button>
          </div>
        ) : null}
      </div>

      <div className="consoleactions">
        <div className="headeractionwrap">
          <button className="taskbutton" type="button" onClick={() => togglePanel('tasks')} aria-haspopup="dialog" aria-expanded={panel === 'tasks'}>
            任务
            <span aria-label="任务状态待同步" />
          </button>
          {panel === 'tasks' ? <StatusPopup title="当前任务" detail="任务数据待服务端同步。" /> : null}
        </div>
        <span className="languageindicator" aria-label="当前语言：中文">
          中文
        </span>
        <div className="headeractionwrap">
          <button className="iconbutton" type="button" onClick={() => togglePanel('notices')} aria-label="通知中心" aria-haspopup="dialog" aria-expanded={panel === 'notices'}>
            <ShellIcon name="bell" />
          </button>
          {panel === 'notices' ? <StatusPopup title="通知中心" detail="最新运行状态已同步。" /> : null}
        </div>
        <div className="headeractionwrap operatorprofile">
          <button className="avatarbutton" type="button" onClick={() => togglePanel('account')} aria-label={`打开 ${displayName} 的账户菜单`} aria-haspopup="dialog" aria-expanded={panel === 'account'}>
            {avatarLetter(displayName)}
          </button>
          <span className="operatorcopy" aria-hidden="true">
            <span>
              <strong>{displayName}</strong>
            </span>
            <small>
              {scopeLabel} · 安全等级 {assuranceLevel}
            </small>
          </span>
          {panel === 'account' ? (
            <div className="headerpopup accountpopup" role="dialog" aria-label="账户菜单">
              <strong>{displayName}</strong>
              <span>{scopeLabel}</span>
              <span>
                安全等级 {assuranceLevel} · {formatTime(syncedAt)}
              </span>
              {assuranceLevel >= 3 ? (
                <span>二次验证已完成</span>
              ) : (
                <button type="button" onClick={onStepup}>
                  完成二次验证
                </button>
              )}
              <button type="button" onClick={onLogout} disabled={loggingOut}>
                {loggingOut ? '正在退出' : '退出登录'}
              </button>
              {logoutError === undefined ? null : <em role="alert">{logoutError}</em>}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function StatusPopup({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="headerpopup statuspopup" role="dialog" aria-label={title}>
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '同步时间未知' : `同步于 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}
