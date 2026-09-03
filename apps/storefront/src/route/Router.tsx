import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { RouteLoading } from '@shop/design';
import { RouteRegistry } from '../app/RouteRegistry';
import { ROUTES } from '../generated/RouteBinding';
import { StorefrontShell } from '../shell/StorefrontShell';
import { useShellViewModel } from '../shell/ShellViewModel';
import { Guard } from './Guard';
import { Scroll } from './Scroll';

const bindings = RouteRegistry.routes().map((route) => Object.freeze({ ...route, Component: lazy(() => route.load().then((module) => ({ default: module.Component }))) }));

export function Router() {
  const shell = useShellViewModel();
  return <StorefrontShell viewmodel={shell}><Scroll/><Suspense fallback={<RouteLoading/>}><Routes>{bindings.map(({ routeid, protected: guarded, Component }) => <Route key={routeid} path={ROUTES[routeid]} element={guarded ? <Guard><Component/></Guard> : <Component/>}/>) }<Route path="*" element={<Navigate replace to={ROUTES.storehome}/>} /></Routes></Suspense></StorefrontShell>;
}
