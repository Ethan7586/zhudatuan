import { NavigationIcon } from '@shop/design';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ShellDestination } from '../entity/session/viewmodel/ShellProjection';
import { ShellIcon } from './ShellIcon';

export interface HeaderProps {
  readonly title: string;
  readonly summary: string;
  readonly scopeLabel: string;
  readonly displayName: string;
  readonly assuranceLevel: number;
  readonly syncedAt: string;
  readonly loggingOut: boolean;
  readonly disablingStepup: boolean;
  readonly logoutError?: string;
  readonly stepupError?: string;
  readonly taskCenter: ReactNode;
  readonly destinations: readonly ShellDestination[];
  readonly notification?: ShellDestination;
  readonly support?: ShellDestination;
  readonly onStepup: () => void;
  readonly onDisableStepup: () => void;
  readonly onLogout: () => void;
  readonly onNavigate: (route: string) => void;
  readonly onOpenNavigation: () => void;
}

type HeaderPanel = 'account' | 'command' | null;

export function Header(props: HeaderProps) {
  const { title, summary, scopeLabel, displayName, assuranceLevel, syncedAt, loggingOut, disablingStepup, logoutError, stepupError, taskCenter, destinations, notification, support, onLogout, onStepup, onDisableStepup, onNavigate, onOpenNavigation } = props;
  const [panel, setPanel] = useState<HeaderPanel>(null);
  const [commandQuery, setCommandQuery] = useState('');
  const commandInput = useRef<HTMLInputElement>(null);
  const commandResults = useMemo(() => {
    const query = normalizeSearch(commandQuery);
    const matches = query.length === 0 ? destinations : destinations.filter(({ title, detail }) => normalizeSearch(`${title} ${detail}`).includes(query));
    return matches.slice(0, 8);
  }, [commandQuery, destinations]);

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
    if (panel !== 'command') return;
    commandInput.current?.focus();
    commandInput.current?.select();
  }, [panel]);

  const togglePanel = (next: Exclude<HeaderPanel, null>) => {
    if (next === 'command') setCommandQuery('');
    setPanel((current) => (current === next ? null : next));
  };
  const openDestination = (destination: ShellDestination) => {
    setPanel(null);
    onNavigate(destination.route);
  };

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
        <button className="commandtrigger" type="button" onClick={() => togglePanel('command')} aria-label="搜索已授权页面" aria-haspopup="dialog" aria-expanded={panel === 'command'}>
          <ShellIcon name="search" />
          <span>搜索已授权页面…</span>
          <kbd>⌘ K</kbd>
        </button>
        {panel === 'command' ? (
          <div className="headerpopup commandpopup" role="dialog" aria-label="页面搜索">
            <label htmlFor="shellcommand">搜索当前范围内已授权的页面</label>
            <input
              ref={commandInput}
              id="shellcommand"
              type="search"
              value={commandQuery}
              placeholder="例如：订单、退款或成员"
              autoComplete="off"
              onChange={(event) => setCommandQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && commandResults[0] !== undefined) openDestination(commandResults[0]);
              }}
            />
            <p role="status">{commandResults.length === 0 ? '没有匹配的已授权页面，请换个业务词。' : `找到 ${commandResults.length} 个页面`}</p>
            <ul className="commandresults">
              {commandResults.map((destination) => (
                <li key={destination.key}>
                  <button type="button" onClick={() => openDestination(destination)}>
                    <NavigationIcon icon={destination.icon} />
                    <span>
                      <strong>{destination.title}</strong>
                      <small>{destination.detail}</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="consoleactions">
        {taskCenter}
        <span className="languageindicator" aria-label="当前语言：中文">
          中文
        </span>
        {notification === undefined ? null : (
          <button className="iconbutton" type="button" onClick={() => openDestination(notification)} aria-label={`打开${notification.title}`} title={notification.title}>
            <ShellIcon name="bell" />
          </button>
        )}
        {support === undefined ? null : (
          <button className="iconbutton" type="button" onClick={() => openDestination(support)} aria-label={`打开${support.title}`} title={support.title}>
            <ShellIcon name="help" />
          </button>
        )}
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
                <button type="button" onClick={() => onDisableStepup()} disabled={disablingStepup}>
                  {disablingStepup ? '正在关闭二次验证' : '关闭二次验证'}
                </button>
              ) : (
                <button type="button" onClick={() => onStepup()}>
                  开启二次验证
                </button>
              )}
              {stepupError === undefined ? null : <em role="alert">{stepupError}</em>}
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

function avatarLetter(displayName: string): string {
  return displayName.match(/[A-Za-z]/)?.[0]?.toUpperCase() ?? (displayName.trim().slice(0, 1) || '智');
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '同步时间未知' : `同步于 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('zh-CN').replace(/\s+/gu, '');
}
