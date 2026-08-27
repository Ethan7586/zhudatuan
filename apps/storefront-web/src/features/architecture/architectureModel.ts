export interface ArchitectureNode {
  id: string;
  title: string;
  subtitle: string;
  layer: 'client' | 'edge' | 'service' | 'data';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArchitectureLink {
  from: string;
  to: string;
  label?: string;
}

export const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: 'web',
    title: 'PC / 笔记本 Web',
    subtitle: 'React 19 · Vinext',
    layer: 'client',
    x: 60,
    y: 75,
    width: 205,
    height: 62,
  },
  {
    id: 'mini',
    title: '微信小程序',
    subtitle: '美团式移动交互',
    layer: 'client',
    x: 305,
    y: 75,
    width: 180,
    height: 62,
  },
  {
    id: 'android',
    title: 'Android App',
    subtitle: '移动端应用壳',
    layer: 'client',
    x: 525,
    y: 75,
    width: 180,
    height: 62,
  },
  {
    id: 'tablet',
    title: '平板端',
    subtitle: '横屏 / 竖屏',
    layer: 'client',
    x: 745,
    y: 75,
    width: 175,
    height: 62,
  },
  {
    id: 'cdn',
    title: 'Cloudflare 全球边缘',
    subtitle: 'TLS · CDN · 静态资源',
    layer: 'edge',
    x: 150,
    y: 220,
    width: 250,
    height: 68,
  },
  {
    id: 'worker',
    title: 'API Worker',
    subtitle: '鉴权 · 限流 · 参数校验',
    layer: 'edge',
    x: 485,
    y: 220,
    width: 250,
    height: 68,
  },
  {
    id: 'session',
    title: '企业会话与权限',
    subtitle: 'Cookie · RBAC · 租户范围',
    layer: 'edge',
    x: 820,
    y: 220,
    width: 250,
    height: 68,
  },
  {
    id: 'catalog',
    title: '商品与分类域',
    subtitle: '目录 · SKU · 库存',
    layer: 'service',
    x: 55,
    y: 385,
    width: 195,
    height: 68,
  },
  {
    id: 'order',
    title: '订单交易域',
    subtitle: '拆单 · 幂等 · 状态机',
    layer: 'service',
    x: 280,
    y: 385,
    width: 195,
    height: 68,
  },
  {
    id: 'account',
    title: '福利账户域',
    subtitle: '福利卡 · 餐卡 · 流水',
    layer: 'service',
    x: 505,
    y: 385,
    width: 195,
    height: 68,
  },
  {
    id: 'after',
    title: '售后服务域',
    subtitle: '退款 · 审核 · 客服',
    layer: 'service',
    x: 730,
    y: 385,
    width: 195,
    height: 68,
  },
  {
    id: 'supplier',
    title: '供应商适配层',
    subtitle: '库存 · 履约 · 卡券',
    layer: 'service',
    x: 955,
    y: 385,
    width: 195,
    height: 68,
  },
  {
    id: 'postgres',
    title: 'Supabase PostgreSQL',
    subtitle: '东京区 · 业务主数据',
    layer: 'data',
    x: 95,
    y: 555,
    width: 245,
    height: 72,
  },
  {
    id: 'rls',
    title: 'RLS 租户隔离',
    subtitle: '集团 / 商城 / 员工',
    layer: 'data',
    x: 385,
    y: 555,
    width: 210,
    height: 72,
  },
  {
    id: 'audit',
    title: '审计与财务流水',
    subtitle: '不可抵赖 · 可追溯',
    layer: 'data',
    x: 640,
    y: 555,
    width: 210,
    height: 72,
  },
  {
    id: 'secret',
    title: '密钥与隐私保护',
    subtitle: 'PII 加密 · 环境密钥',
    layer: 'data',
    x: 895,
    y: 555,
    width: 220,
    height: 72,
  },
];

export const ARCHITECTURE_LINKS: ArchitectureLink[] = [
  ...['web', 'mini', 'android', 'tablet'].map((from) => ({ from, to: 'cdn' })),
  { from: 'cdn', to: 'worker', label: 'HTTPS / JSON' },
  { from: 'worker', to: 'session', label: '身份与授权' },
  ...['catalog', 'order', 'account', 'after', 'supplier'].map((to) => ({
    from: 'worker',
    to,
  })),
  ...['catalog', 'order', 'account', 'after'].map((from) => ({
    from,
    to: 'postgres',
  })),
  { from: 'postgres', to: 'rls' },
  { from: 'postgres', to: 'audit' },
  { from: 'worker', to: 'secret' },
];
