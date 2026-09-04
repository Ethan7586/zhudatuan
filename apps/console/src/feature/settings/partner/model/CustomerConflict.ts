import type { Customer } from './Customer';

export interface CustomerConflict {
  readonly title: string;
  readonly details: readonly string[];
  readonly customer?: Customer;
}

export function customerConflict(previous: Customer, current: Customer | undefined): CustomerConflict {
  if (current === undefined) return Object.freeze({ title: '客户已离开当前管理范围', details: Object.freeze(['系统没有把本次修改应用到其他客户，请关闭后重新选择。']) });
  const details = [`数据版本：第 ${previous.version} 版 → 第 ${current.version} 版`];
  if (previous.name !== current.name) details.push(`客户名称：${previous.name} → ${current.name}`);
  if (previous.kind !== current.kind) details.push('客户类型已变化');
  if (previous.status !== current.status) details.push(`客户状态：${previous.status} → ${current.status}`);
  if (previous.agreement?.version !== current.agreement?.version) details.push('合作协议版本已变化');
  return Object.freeze({ title: '客户权威状态已变化', details: Object.freeze(details), customer: current });
}
