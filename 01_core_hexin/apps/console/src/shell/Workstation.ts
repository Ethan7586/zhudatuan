import type { IconName } from '../shared/ui/Icon';

export type WorkstationKey = 'cockpit' | 'control' | 'products' | 'orders' | 'finance';

export interface Workstation {
  readonly key: WorkstationKey;
  readonly title: string;
  readonly summary: string;
  readonly icon: IconName;
}

export const workstations: readonly Workstation[] = Object.freeze([
  { key: 'cockpit', title: '生意看板', summary: '销售结果、经营趋势与待办事项', icon: 'chart' },
  { key: 'control', title: '中控台', summary: '系统效率、处理能力和恢复状态', icon: 'gauge' },
  { key: 'products', title: '商品管理', summary: '核心商品、可售状态和批量任务', icon: 'product' },
  { key: 'orders', title: '订单管理', summary: '订单、履约、售后和异常时间线', icon: 'orders' },
  { key: 'finance', title: '财务系统', summary: '账务、账单、对账、结算和发票', icon: 'finance' },
]);

export function workstationFromPath(pathname: string): Workstation | undefined {
  const key = pathname.split('/').filter(Boolean).at(-1);
  return workstations.find((item) => item.key === key);
}
