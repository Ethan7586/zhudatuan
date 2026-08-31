import { lazy, Suspense } from 'react';

const CallbackPage = lazy(() => import('../feature/callback/CallbackPage').then((module) => ({ default: module.CallbackPage })));
const IdentityLinkPage = lazy(() => import('../feature/link/IdentityLinkPage').then((module) => ({ default: module.IdentityLinkPage })));
const AuthFlow = lazy(() => import('./AuthFlow').then((module) => ({ default: module.AuthFlow })));
const MembershipFlow = lazy(() => import('./MembershipFlow').then((module) => ({ default: module.MembershipFlow })));

export function AuthRouter() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const page = path === '/callback' ? <CallbackPage /> : path === '/membership' ? <MembershipFlow /> : path === '/link' ? <IdentityLinkPage /> : <AuthFlow />;
  return <Suspense fallback={null}>{page}</Suspense>;
}
