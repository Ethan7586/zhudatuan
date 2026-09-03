import { createContext, useContext, type ReactNode } from 'react';
import type { Dependencies } from './Dependencies';

const Context = createContext<Dependencies | null>(null);
export function DependencyProvider({ value, children }: Readonly<{ value: Dependencies; children: ReactNode }>) { return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useDependencies(): Dependencies { const value = useContext(Context); if (!value) throw new Error('STOREFRONT_DEPENDENCIES_MISSING'); return value; }
