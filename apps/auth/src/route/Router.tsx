import { lazy, Suspense } from 'react';
import { BrowserRouter, Link as RouteLink, Route, Routes, useLocation, useNavigate } from 'react-router';
import type { Dependencies } from '../app/Dependencies';
import { AuthRuntime } from '../app/AuthRuntime';
import { AuthCard } from '../shell/AuthCard';
import { AuthShell } from '../shell/AuthShell';
import { Loading } from '../shared/ui/Loading';
import { authTargetSearch } from '../shared/security/ReturnTarget';
import { Guard } from './Guard';
import { ROUTES } from './Routes';

const CallbackPage = lazy(() => import('../feature/federation/ui/CallbackPage').then((module) => ({ default: module.CallbackPage })));
const LinkPage = lazy(() => import('../feature/link/ui/LinkPage').then((module) => ({ default: module.LinkPage })));
const MembershipRuntime = lazy(() => import('../app/MembershipRuntime'));

export function Router({ dependencies }: Readonly<{ dependencies: Dependencies }>) {
  return <BrowserRouter><Suspense fallback={<AuthShell><AuthCard stage={1} onBack={() => undefined}><Loading /></AuthCard></AuthShell>}><RouteTable dependencies={dependencies} /></Suspense></BrowserRouter>;
}

function RouteTable({ dependencies }: Readonly<{ dependencies: Dependencies }>) {
  const navigate = useNavigate();
  const location = useLocation();
  const rejected = <InvalidRoute />;
  const login = (invitation: boolean) => <Guard route={invitation ? ROUTES.invitation : ROUTES.login} rejected={rejected}>{(request) => <AuthRuntime dependencies={dependencies} request={request} invitation={invitation} onTarget={(target) => navigate({ pathname: location.pathname, search: authTargetSearch(location.search, target) }, { replace: true })} />}</Guard>;
  return <Routes>
    <Route path={ROUTES.login} element={login(false)} />
    <Route path={ROUTES.invitation} element={login(true)} />
    <Route path={ROUTES.membership} element={<Guard route={ROUTES.membership} rejected={rejected}>{(request) => <MembershipRuntime dependencies={dependencies} target={request.target} onRestart={() => navigate(ROUTES.login, { replace: true })} />}</Guard>} />
    <Route path={ROUTES.callback} element={<Guard route={ROUTES.callback} rejected={rejected}>{() => <CallbackPage onBack={() => navigate(ROUTES.login, { replace: true })} />}</Guard>} />
    <Route path={ROUTES.link} element={<Guard route={ROUTES.link} rejected={rejected}>{() => <LinkPage onBack={() => navigate(ROUTES.login, { replace: true })} />}</Guard>} />
    <Route path="*" element={<NotFound />} />
  </Routes>;
}

function InvalidRoute() {
  return <AuthShell><AuthCard stage={1} onBack={() => undefined}><section className="authstatus"><h1>链接不可用</h1><p>该登录链接不完整、重复或包含不受支持的参数。</p><RouteLink className="authprimary" to={ROUTES.login} replace>返回安全登录</RouteLink></section></AuthCard></AuthShell>;
}

function NotFound() {
  return <AuthShell><AuthCard stage={1} onBack={() => undefined}><section className="authstatus"><h1>页面不存在</h1><p>请从统一登录入口重新开始。</p><RouteLink className="authprimary" to={ROUTES.login} replace>返回安全登录</RouteLink></section></AuthCard></AuthShell>;
}
