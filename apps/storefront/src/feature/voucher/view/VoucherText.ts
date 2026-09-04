export function money(value: number, currency: string) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(value / 100); }
export function date(value: string) { return new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }); }
export function dateTime(value: string) { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
export function stateLabel(value: string | null) {
  if (value === null) return '创建';
  return ({ generated: '已生成', available: '待发放', allocated: '已分配', bound: '已到账', active: '可使用', held: '使用中', redeemed: '已核销', reversed: '已返还', disabled: '已停用', expired: '已过期', void: '已作废' } as Record<string, string>)[value] ?? '状态更新中';
}
export function reasonLabel(value: string) {
  return ({ activation: '完成激活', checkoutreserve: '结算占用', checkoutrelease: '结算释放', tenderhold: '核销占用', redemption: '完成核销',
    atomicredeem: '核验成功并核销', holdconsume: '完成核销', refund: '完成退款', issue: '完成发放', maintenance: '系统维护' } as Record<string, string>)[value] ?? '卡券状态已更新';
}
