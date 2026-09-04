import { createContext, useContext, type ReactNode } from 'react';
import type { ConsoleContext } from './ConsoleSession';

const Context = createContext<ConsoleContext | null>(null);

export function ConsoleContextProvider({ value, children }: Readonly<{ value: ConsoleContext; children: ReactNode }>) {
  return <Context value={value}>{children}</Context>;
}

export function useConsoleContext(): ConsoleContext {
  const value = useContext(Context);
  if (value === null) throw new Error('CONSOLE_CONTEXT_MISSING');
  return value;
}
