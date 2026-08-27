export interface OperationDefinition {
  readonly id: string;
  readonly owner: string;
  readonly method: string;
  readonly path: string;
  readonly permission?: string;
  readonly requirements: readonly string[];
}

export const TABLE_BY_MODULE: Readonly<Record<string, string>> = Object.freeze({
  access: 'access.membershiprole',
  audit: 'audit.entry',
  benefit: 'benefit.account',
  capability: 'capability.assignment',
  cart: 'cart.cart',
  catalog: 'catalog.product',
  channel: 'channel.connection',
  checkout: 'checkout.quote',
  experience: 'experience.application',
  extension: 'extension.installation',
  finance: 'finance.journal',
  fulfillment: 'fulfillment.fulfillmentorder',
  identity: 'identity.membersession',
  inventory: 'inventory.stock',
  marketing: 'marketing.campaign',
  member: 'member.membership',
  notification: 'notification.template',
  order: 'ordering.orderrecord',
  organization: 'organization.organization',
  partner: 'partner.partner',
  payment: 'payment.paymentintent',
  pricing: 'pricing.rule',
  qualification: 'qualification.policy',
  reporting: 'reporting.metric',
  risk: 'risk.policy',
  support: 'support.case',
  verification: 'verification.challenge',
  voucher: 'voucher.voucher',
});

export function moduleFor(prefix: string, value: string): string {
  if (prefix === 'INTEG' || prefix === 'CHAIN') return 'channel';
  const rules: readonly [RegExp, string][] = [
    [/客服|工单|聊天|坐席|SLA/i, 'support'],
    [/报表|统计|排行|大屏|数据汇总|销售数据|营业快报/i, 'reporting'],
    [/发票|财务|账单|对账|结算|分账|提现|充值|账户余额/i, 'finance'],
    [/售后|退货|换货|订单/i, 'order'],
    [/发货|物流|签收|履约|地址/i, 'fulfillment'],
    [/核销|消费记录|会员码|券码/i, 'verification'],
    [/卡券|券|卡号|积分卡|礼包/i, 'voucher'],
    [/支付|微信|支付宝/i, 'payment'],
    [/库存/i, 'inventory'],
    [/加价|价格|利润率|服务费|税点/i, 'pricing'],
    [/商品|分类|产品档案|下载中心/i, 'catalog'],
    [/装修|首页编辑|微页面|应用|商城创建|复制商城|模板/i, 'experience'],
    [/营销|秒杀|抽奖|优惠|分发|积分\/礼包/i, 'marketing'],
    [/供应商|门店|品牌|商户|协议/i, 'partner'],
    [/会员|客户|员工|用户数据|用户管理/i, 'member'],
    [/角色|权限|菜单|账号设置|管理员/i, 'access'],
    [/短信|消息提醒|公告|语音播报/i, 'notification'],
    [/风控|白名单|限售|IP|安全|登录设置/i, 'risk'],
    [/套餐|插件|功能菜单|能力/i, 'capability'],
    [/审批|资格|规则/i, 'qualification'],
    [/渠道|接口|同步/i, 'channel'],
    [/平台|分销|集团|商城|组织|部门|层级|站点|设置|系统升级|附件/i, 'organization'],
  ];
  return rules.find(([pattern]) => pattern.test(value))?.[1] ?? 'organization';
}

export function operationFor(operations: readonly OperationDefinition[], module: string, text: string): OperationDefinition {
  const candidates = operations.filter(({ owner, path }) => owner === module && path.startsWith('/api/v1'));
  if (candidates.length === 0) throw new Error('REQUIREMENT_OWNER_WITHOUT_OPERATION:' + module);
  const readOnly = /查询|查看|列表|详情|统计|大屏|总览|记录|汇总|排行|展示|搜索/.test(text)
    && !/增删|创建|新增|修改|设置|管理|操作|审核|绑定|配置|上传|下架|充值|提现|核销/.test(text);
  const preferred = candidates.filter(({ method }) => readOnly ? method === 'GET' : method !== 'GET');
  return preferred[0] ?? candidates.find(({ method }) => method === 'GET') ?? candidates[0]!;
}

export function routeFor(prefix: string, module: string): string {
  if (prefix === 'PLAT') return module === 'channel' || module === 'extension' ? '/channels' : '/platform';
  if (prefix === 'DIST') return '/distributors';
  if (prefix === 'STORE') return '/stores/current/' + (module === 'verification' ? 'verification' : module);
  if (prefix === 'SUPPLY') return '/suppliers/current/' + module;
  if (prefix === 'CHAIN' || prefix === 'INTEG') return '/channels';
  const base = prefix === 'GROUP' ? '/enterprises/current' : '/malls/current';
  if (module === 'reporting') return base + '/dashboard';
  if (module === 'experience') return base + (prefix === 'GROUP' ? '/applications' : '/design');
  if (['catalog', 'pricing', 'inventory', 'channel'].includes(module)) return base + '/products';
  if (['order', 'fulfillment', 'payment', 'checkout'].includes(module)) return base + '/orders';
  if (['voucher', 'verification', 'benefit'].includes(module)) return base + '/vouchers';
  if (module === 'finance') return base + '/finance';
  if (module === 'support') return base + '/support';
  return base + '/settings';
}

export function journeyFor(prefix: string, module: string): string {
  if (prefix === 'PLAT' || prefix === 'STORE') return 'tests/journeys/mvp03_platform.spec.ts';
  if (prefix === 'DIST') return 'tests/journeys/mvp04_distribution.spec.ts';
  if (prefix === 'INTEG' || prefix === 'CHAIN' || prefix === 'SUPPLY') return 'tests/journeys/mvp23_providers.spec.ts';
  const group = prefix === 'GROUP';
  const number = group ? groupMvp(module) : mallMvp(module);
  const name = group ? groupJourney(module) : mallJourney(module);
  return 'tests/journeys/mvp' + number + '_' + name + '.spec.ts';
}

function groupMvp(module: string): string {
  return ({ reporting: '05', experience: '06', catalog: '07', pricing: '07', inventory: '07', channel: '07', order: '08', fulfillment: '08',
    payment: '08', voucher: '09', verification: '09', benefit: '09', finance: '10', support: '12' } as Record<string, string>)[module] ?? '13';
}
function groupJourney(module: string): string {
  return ({ reporting: 'groupdashboard', experience: 'groupapplication', catalog: 'groupproduct', pricing: 'groupproduct', inventory: 'groupproduct',
    channel: 'groupproduct', order: 'grouporder', fulfillment: 'grouporder', payment: 'grouporder', voucher: 'groupvoucher',
    verification: 'groupvoucher', benefit: 'groupvoucher', finance: 'groupfinance', support: 'groupsupport' } as Record<string, string>)[module] ?? 'groupsetting';
}
function mallMvp(module: string): string {
  return ({ reporting: '14', experience: '15', catalog: '16', pricing: '16', inventory: '16', channel: '16', order: '17', fulfillment: '17',
    payment: '17', voucher: '18', verification: '18', benefit: '18', finance: '19', support: '21' } as Record<string, string>)[module] ?? '22';
}
function mallJourney(module: string): string {
  return ({ reporting: 'malldashboard', experience: 'malldesign', catalog: 'mallproduct', pricing: 'mallproduct', inventory: 'mallproduct',
    channel: 'mallproduct', order: 'mallorder', fulfillment: 'mallorder', payment: 'mallorder', voucher: 'mallvoucher',
    verification: 'mallvoucher', benefit: 'mallvoucher', finance: 'mallfinance', support: 'mallsupport' } as Record<string, string>)[module] ?? 'mallsetting';
}

export function priorityFrom(value: string): string {
  return /P3/i.test(value) ? 'P3' : /P2/i.test(value) ? 'P2' : 'Unspecified';
}

export function stepupFor(value: string): string {
  return /提现|退款|密码|权限|角色|白名单|开票|支付/.test(value) ? 'required' : 'policy';
}
