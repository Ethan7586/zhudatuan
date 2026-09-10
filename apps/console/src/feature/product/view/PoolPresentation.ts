import type { PoolMode } from '../viewmodel/ProductPoolViewModel';

export function poolGuidance(operation: PoolMode): string {
  if (operation === 'move') return '请选择新的目标池；当前所在商品池不可重复选择。';
  if (operation === 'allocate') return '请选择需要复制商品的来源池，来源池本身不会发生变化。';
  return operation === 'attach' ? '请选择要提供给商城使用的商品池。' : '请选择要从商城停止投放的商品池。';
}

export function poolSubmitLabel(operation: PoolMode): string {
  if (operation === 'allocate') return '创建派生池';
  if (operation === 'attach') return '确认投放';
  if (operation === 'detach') return '停止投放';
  if (operation === 'move') return '确认移入';
  return '确认移出';
}
