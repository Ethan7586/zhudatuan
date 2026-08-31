import { createContext, useContext, type ReactNode } from 'react';

const RouteTitle = createContext<string | null>(null);

export function RouteTitleProvider({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <RouteTitle value={title}>{children}</RouteTitle>;
}

export function useRouteTitle(fallback: string): string {
  return useContext(RouteTitle) ?? fallback;
}
