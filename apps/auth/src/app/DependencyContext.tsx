import { createContext, useContext, type ReactNode } from 'react';
import type { Dependencies } from './Dependencies';

const Context = createContext<Dependencies | undefined>(undefined);
export function DependencyProvider({ value, children }: Readonly<{ value: Dependencies; children: ReactNode }>) { return <Context value={value}>{children}</Context>; }
export function useDependencies(): Dependencies { const value = useContext(Context); if (value === undefined) throw new Error('AUTH_DEPENDENCIES_MISSING'); return value; }
