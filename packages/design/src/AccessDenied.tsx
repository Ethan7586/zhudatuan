import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';

export type AccessDeniedKind = 'forbidden' | 'unauthenticated';

export interface AccessDeniedActions {
  readonly onSwitchScope?: () => void;
  readonly onReturnToWorkspace?: () => void;
  readonly onRelogin?: () => void;
}

export interface AccessDeniedProps {
  readonly kind?: AccessDeniedKind;
  readonly resourceLabel?: string;
  readonly actions?: AccessDeniedActions;
}

const AccessDeniedActionsContext = createContext<AccessDeniedActions | undefined>(undefined);

export function AccessDeniedActionsProvider({
  actions,
  children,
}: Readonly<{
  actions: AccessDeniedActions;
  children: ReactNode;
}>) {
  return <AccessDeniedActionsContext.Provider value={actions}>{children}</AccessDeniedActionsContext.Provider>;
}

export function ContextualAccessDenied(props: AccessDeniedProps) {
  const actions = useContext(AccessDeniedActionsContext);
  return <AccessDenied {...props} {...(props.actions === undefined && actions !== undefined ? { actions } : {})} />;
}

export function AccessDenied({ kind = 'forbidden', resourceLabel, actions }: AccessDeniedProps) {
  const containerRef = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const requestHelpId = useId();
  const [requestHelpOpen, setRequestHelpOpen] = useState(false);
  const unauthenticated = kind === 'unauthenticated';
  const title = unauthenticated ? '登录已失效' : '需要访问权限';
  const subject =
    resourceLabel === undefined
      ? unauthenticated
        ? '当前登录状态已过期，无法继续查看此页面。'
        : '当前账号尚未开通此页面。'
      : unauthenticated
        ? `当前登录状态已过期，无法继续查看「${resourceLabel}」。`
        : `当前账号尚未开通「${resourceLabel}」。`;
  const guidance = unauthenticated ? '请重新登录后继续操作。' : '如工作需要，可以向管理员申请访问；审核通过后即可使用。';
  const hasActions = !unauthenticated || actions?.onReturnToWorkspace !== undefined || actions?.onRelogin !== undefined;

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  if (!unauthenticated) {
    return (
      <section
        ref={containerRef}
        className="swaccessdenied swaccessdeniedforbidden"
        role="region"
        tabIndex={-1}
        aria-live="polite"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className="swaccessdenieddimcontent">
          <h2 id={titleId}>没有权限</h2>
          <p id={descriptionId}>{resourceLabel === undefined ? '当前界面不可访问' : `「${resourceLabel}」不可访问`}</p>
        </div>
      </section>
    );
  }

  const subject = resourceLabel === undefined
    ? '当前登录状态已过期，无法继续查看此页面。'
    : `当前登录状态已过期，无法继续查看「${resourceLabel}」。`;
  const hasActions = actions?.onReturnToWorkspace !== undefined || actions?.onRelogin !== undefined;

  return (
    <section
      ref={containerRef}
      className="swaccessdenied"
      role="region"
      tabIndex={-1}
      aria-live="polite"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <span className="swaccessdeniedlabel">{unauthenticated ? '身份验证' : '权限保护'}</span>
      <div className="swaccessdeniedvisual" aria-hidden="true">
        <svg viewBox="0 0 96 96" focusable="false">
          <path className="swaccessdeniedshield" d="M48 12 76 23v22c0 19-11 33-28 41C31 78 20 64 20 45V23L48 12Z" />
          <path className="swaccessdeniedshinelight" d="M48 19 69 27v18c0 14-7 25-21 33-5-3-9-6-12-10 17-7 25-21 25-41L48 19Z" />
          <rect className="swaccessdeniedlock" x="35" y="43" width="26" height="21" rx="5" />
          <path className="swaccessdeniedlockline" d="M40 43v-5a8 8 0 0 1 16 0v5" />
          <circle className="swaccessdeniedkey" cx="48" cy="53" r="2.5" />
          <path className="swaccessdeniedkey" d="M48 55v4" />
        </svg>
      </div>
      <h2 id={titleId}>登录已失效</h2>
      <div id={descriptionId} className="swaccessdeniedcopy">
        <p>{subject}</p>
        <p>请重新登录后继续操作。</p>
      </div>
      {hasActions ? (
        <div className="swaccessdeniedactions" role="group" aria-label="访问受限操作">
          {unauthenticated ? (
            <>
              {actions?.onRelogin === undefined ? null : (
                <Button tone="primary" onPress={actions.onRelogin}>
                  重新登录
                </Button>
              )}
              {actions?.onReturnToWorkspace === undefined ? null : <Button onPress={actions.onReturnToWorkspace}>返回工作台</Button>}
            </>
          ) : (
            <>
              <Button className="swaccessdeniedrequestbutton" tone="primary"
                aria-expanded={requestHelpOpen} aria-controls={requestHelpId}
                onPress={() => setRequestHelpOpen((open) => !open)}>
                申请访问权限
              </Button>
              {actions?.onSwitchScope === undefined ? null : (
                <Button onPress={actions.onSwitchScope}>
                  切换商城
                </Button>
              )}
              {actions?.onReturnToWorkspace === undefined ? null : (
                <Button onPress={actions.onReturnToWorkspace}>
                  返回工作台
                </Button>
              )}
            </>
          )}
          {actions?.onReturnToWorkspace === undefined ? null : <Button onPress={actions.onReturnToWorkspace}>返回工作台</Button>}
        </div>
      ) : null}
      {!unauthenticated && requestHelpOpen ? (
        <div id={requestHelpId} className="swaccessdeniedrequest" role="status">
          <strong>申请说明</strong>
          <p>请将「{resourceLabel ?? '当前页面'}」和当前商城名称发送给商城 Owner 或平台管理员审核。当前为演示环境，不会自动提交申请。</p>
        </div>
      ) : null}
    </section>
  );
}
