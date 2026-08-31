import type { IconName } from '../shared/ui/Icon';
import { consoleModuleById } from '../route/ConsoleModuleRegistry';

export type WorkstationKey = 'cockpit' | 'control' | 'products' | 'orders' | 'finance';

export interface Workstation {
  readonly key: WorkstationKey;
  readonly title: string;
  readonly summary: string;
  readonly icon: IconName;
}

const workstationModuleIds = ['cockpit', 'control', 'products', 'orders', 'finance'] as const;
const workstationIcons: Readonly<Record<WorkstationKey, IconName>> = Object.freeze({
  cockpit: 'chart',
  control: 'gauge',
  products: 'product',
  orders: 'orders',
  finance: 'finance',
});

export const workstations: readonly Workstation[] = Object.freeze(workstationModuleIds.map((key) => {
  const module = consoleModuleById.get(key)!;
  const entry = module.routes.find(({ kind }) => kind === 'entry')!;
  return { key, title: entry.presentation.title, summary: entry.presentation.summary, icon: workstationIcons[key] };
}));

export function workstationFromPath(pathname: string): Workstation | undefined {
  const key = pathname.split('/').filter(Boolean).at(-1);
  return workstations.find((item) => item.key === key);
}
