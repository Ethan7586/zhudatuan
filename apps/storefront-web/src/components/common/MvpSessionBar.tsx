import React, { useEffect, useRef, useState } from 'react';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { useMall } from '../../context/MallContext';

export const MvpSessionBar: React.FC = () => {
  const { sessionStatus, catalogSyncStatus, logout } = useMall();
  const [showLoginDrawer, setShowLoginDrawer] = useState(false);
  const [loginUrl, setLoginUrl] = useState('/login?embed=storefront');
  const loginFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      setLoginUrl('http://localhost:3010/?embed=storefront');
    }
  }, []);

  useEffect(() => {
    const handleEmbeddedLoginEvent = (event: MessageEvent) => {
      if (event.source !== loginFrameRef.current?.contentWindow) return;
      const expectedOrigin = new URL(loginUrl, window.location.href).origin;
      if (event.origin !== expectedOrigin) return;

      if (event.data?.type === 'smart-wing:storefront-login-complete') {
        // 登录页已在同源 iframe 内写入 HttpOnly Cookie；刷新后由商城重新拉取会话。
        window.location.reload();
        return;
      }

      if (event.data?.type === 'smart-wing:close-login-drawer') {
        setShowLoginDrawer(false);
        return;
      }

      if (event.data?.type === 'smart-wing:admin-login-complete' && typeof event.data.redirectUrl === 'string') {
        const redirectUrl = new URL(event.data.redirectUrl);
        if (redirectUrl.protocol === 'https:' && ['console.zhudatuan.com', 'smart.hbbtzn.com'].includes(redirectUrl.hostname)) {
          window.location.assign(redirectUrl.toString());
        }
      }
    };
    window.addEventListener('message', handleEmbeddedLoginEvent);
    return () => window.removeEventListener('message', handleEmbeddedLoginEvent);
  }, [loginUrl]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowLoginDrawer(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  if (sessionStatus === 'checking') {
    return <div className="bg-[var(--sw-brand-light)] border-b border-blue-200 text-[var(--sw-brand-dark)] text-xs py-2 px-4 text-center">正在检查登录状态并同步商城数据…</div>;
  }

  return (
    <>
      <div className={`border-b text-xs py-2 px-4 ${sessionStatus === 'authenticated' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
        <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            {sessionStatus === 'authenticated'
              ? catalogSyncStatus === 'syncing'
                ? '账户与订单已连接，正在更新您的专属商品权益'
                : catalogSyncStatus === 'error'
                  ? '账户已登录；专属商品权益更新失败，可刷新重试'
                  : '账户已登录，企业权益、购物车与订单已同步'
              : catalogSyncStatus === 'error'
                ? '商品服务暂时不可用，请稍后刷新重试'
                : '登录后可查看企业专属价格、加入购物车并提交订单'}
          </span>
          {sessionStatus === 'authenticated' ? (
            <button onClick={() => void logout()} className="font-bold flex items-center gap-1 hover:underline">
              <LogOut className="w-3.5 h-3.5" /> 退出
            </button>
          ) : (
            <button onClick={() => setShowLoginDrawer(true)} className="bg-[var(--sw-brand-dark)] text-white rounded px-3 py-1.5 font-bold flex items-center gap-1">
              <LogIn className="w-3.5 h-3.5" /> 登录账户
            </button>
          )}
        </div>
      </div>

      {showLoginDrawer && <button type="button" aria-label="关闭登录" className="fixed inset-0 z-[100] cursor-default bg-slate-950/25" onClick={() => setShowLoginDrawer(false)} />}
      <aside
        aria-hidden={!showLoginDrawer}
        aria-label="统一账号认证"
        className={`fixed inset-y-0 right-0 z-[110] w-full max-w-[600px] bg-transparent transition-transform duration-700 ease-out ${showLoginDrawer ? 'translate-x-0' : 'translate-x-full'}`}
        role={showLoginDrawer ? 'dialog' : undefined}
      >
        {showLoginDrawer && <iframe ref={loginFrameRef} title="智慧翼统一登录" src={loginUrl} className="h-full w-full border-0" />}
      </aside>
    </>
  );
};
