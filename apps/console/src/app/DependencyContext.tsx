import { createContext, useContext, type ReactNode } from 'react';
import type { ConsoleDependencies } from './Dependencies';

const Context = createContext<ConsoleDependencies | undefined>(undefined);

export function DependencyProvider({ value, children }: Readonly<{ value: ConsoleDependencies; children: ReactNode }>) {
  return <Context value={value}>{children}</Context>;
}

export function useDependencies(): ConsoleDependencies {
  const value = useContext(Context);
  if (value === undefined) throw new Error('CONSOLE_DEPENDENCIES_MISSING');
  return value;
}
