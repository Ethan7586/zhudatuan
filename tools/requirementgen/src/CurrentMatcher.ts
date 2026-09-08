import type { CurrentFunctionRow } from './CurrentSource';

export interface MatchableOperation {
  readonly id: string;
  readonly title: string;
  readonly method: string;
}

const NOUNS = Object.freeze([
  term(/登录|退出/, ['session']),
  term(/会话|设备/, ['session']),
  term(/邀请/, ['invitation']),
  term(/注册|入会/, ['enrollment', 'session']),
  term(/密码|改密/, ['password']),
  term(/手机|短信|验证码/, ['mobile', 'challenge']),
  term(/二次核验|高风险核验/, ['stepup']),
  term(/微信|单点|联合身份|企业微信/, ['federation', 'provider', 'link']),
  term(/身份/, ['membership', 'identity', 'federation']),
  term(/会员码|核验挑战/, ['verification.challenge']),
  term(/核验设备/, ['verification.device']),
  term(/组织|层级|工作区|范围/, ['organization.layer', 'access.scope']),
  term(/能力分配/, ['capability.assignment']),
  term(/商城创建|创建新商城|商城信息|入驻资料|商家目录/, ['organization.mall']),
  term(/应用/, ['experience.application']),
  term(/页面版本|装修|设计方案|主题/, ['experience.version', 'experience.published']),
  term(/权限/, ['access.center', 'access.role', 'access.override', 'access.scope']),
  term(/角色/, ['access.role']),
  term(/所有者/, ['access.ownership']),
  term(/商品池|投池/, ['catalog.pool', 'catalog.listing']),
  term(/商品详情/, ['catalog.product.detail']),
  term(/商品|上架|下架/, ['catalog.product', 'catalog.listing', 'storefront.catalog']),
  term(/分类|筛选/, ['facet', 'catalog']),
  term(/价格|定价|报价|调价/, ['pricing', 'offer', 'quote', 'price']),
  term(/库存|可售/, ['inventory', 'availability']),
  term(/购物车/, ['cart']),
  term(/地址/, ['address']),
  term(/收藏/, ['favorite']),
  term(/福利|餐补|津贴|权益/, ['benefit']),
  term(/订单详情/, ['order.detail']),
  term(/订单/, ['order']),
  term(/售后/, ['aftersale']),
  term(/发货|履约/, ['fulfillment', 'shipment']),
  term(/物流/, ['tracking']),
  term(/退货|质检|验收/, ['return', 'inspect']),
  term(/收货/, ['receive']),
  term(/支付/, ['payment']),
  term(/退款/, ['refund']),
  term(/分销商|分销层/, ['channel.distributor']),
  term(/渠道|供应商|连接/, ['channel.connection', 'extension.installation']),
  term(/同步/, ['syncrun']),
  term(/回调/, ['webhook']),
  term(/重放/, ['operation.replay']),
  term(/财务总览/, ['finance.overview']),
  term(/账务|分录/, ['finance.entries']),
  term(/账单|对账单/, ['statement']),
  term(/对账/, ['reconciliation']),
  term(/差异|修复/, ['reconciliationrepair']),
  term(/结算/, ['settlement']),
  term(/提现/, ['withdrawal']),
  term(/暂扣|冻结/, ['hold']),
  term(/期间|关账/, ['period']),
  term(/回补/, ['backfill']),
  term(/发票/, ['invoice']),
  term(/风险/, ['risk']),
  term(/审计/, ['audit']),
  term(/客服|工单/, ['support.case']),
  term(/会话消息|客服回复/, ['support.message']),
  term(/附件/, ['attachment']),
  term(/转派|指派|分配客服/, ['support.assignment']),
  term(/通知/, ['notification.notification']),
  term(/公告/, ['announcement']),
  term(/模板/, ['template']),
  term(/驾驶舱|大屏|指标/, ['reporting.dashboard']),
  term(/报表|统计/, ['reporting']),
  term(/导出/, ['export']),
  term(/导入/, ['import']),
  term(/任务|作业/, ['job']),
  term(/推荐|推广/, ['referral']),
  term(/佣金/, ['commission']),
  term(/收益/, ['earning']),
  term(/备券/, ['stockrequest']),
  term(/发行/, ['issue']),
  term(/卡号库|凭证池/, ['credentialpool']),
  term(/激活/, ['activation']),
  term(/持券人|绑定|解绑/, ['voucher']),
  term(/核销/, ['redemption', 'verification']),
  term(/凭证|卡券|优惠券|券包/, ['voucher']),
  term(/资格|限购/, ['qualification']),
  term(/门店|位置/, ['store']),
]);

const SPECIFIC = Object.freeze([
  term(/多个会员身份|身份选择|身份切换/, ['membership']),
  term(/待接受邀请|邀请凭证/, ['invitation']),
  term(/企业微信|单点登录|微信授权/, ['federation', 'provider']),
  term(/会员基础资料|员工编号|入会信息/, ['member.profile']),
  term(/手机绑定状态|付款资格/, ['identity.mobile']),
  term(/商品主数据|归档商品/, ['catalog.product']),
  term(/卡券方案|储值券产品/, ['voucher.product']),
  term(/分配卡号库/, ['voucher.stockrequest']),
  term(/凭证池/, ['voucher.credentialpool']),
  term(/批量生成凭证/, ['voucher.credentials.generate']),
  term(/批量导入凭证/, ['voucher.credentials.import']),
  term(/作业状态|作业进度/, ['voucher.jobs']),
  term(/使用券号加密钥/, ['voucher.activations.numbersecret']),
  term(/使用密钥激活/, ['voucher.activations.secret']),
  term(/绑定最终持券人/, ['voucher.vouchers.bind']),
  term(/解绑最终持券人/, ['voucher.vouchers.unbind']),
  term(/核销冻结|消费冻结|释放冻结/, ['voucher.tenderhold']),
  term(/冻结目标快照/, ['voucher.searchsnapshot']),
  term(/对账单/, ['statement']),
  term(/账单导入/, ['statementimport']),
  term(/差异修复/, ['reconciliationrepair']),
  term(/快捷命令|顶部通知壳层/, ['navigation.tree']),
]);

const ACTIONS = Object.freeze([
  term(/查看|读取|查询|列表|详情|展示|预览|搜索|筛选|跟踪|状态/, ['read', 'get', 'list', 'preview', 'quote']),
  term(/创建|新建|新增|发起|生成|提交|申请|添加|发送/, ['create', 'start', 'generate', 'submit', 'apply', 'send', 'issue']),
  term(/修改|更新|编辑|维护|保存|配置|调整|设置|更换/, ['update', 'manage', 'revise', 'put', 'set', 'save', 'adjust', 'control']),
  term(/启用|发布|激活|恢复|重开|完成/, ['enable', 'publish', 'activation', 'restore', 'reopen', 'complete']),
  term(/停用|禁用|下架|暂停|关闭|退役|撤销|取消|解绑|删除|作废|过期|归档/, ['disable', 'unpublish', 'cancel', 'revoke', 'delete', 'archive', 'close', 'release', 'control', 'unbind']),
  term(/审批|批准|通过|驳回|审核/, ['decide', 'approve', 'reject']),
  term(/重试/, ['retry']),
  term(/导入/, ['import']),
  term(/导出|下载/, ['export', 'download']),
]);

export function primaryOperation<T extends MatchableOperation>(row: CurrentFunctionRow, operations: readonly T[]): T {
  if (operations.length === 0) throw new Error('CURRENT_FUNCTION_OPERATION_MISSING:' + row.id);
  const text = `${row.qualifier ?? ''}${row.text}`;
  return [...operations].sort((left, right) => score(right, text) - score(left, text) || left.id.localeCompare(right.id))[0]!;
}

function score(operation: MatchableOperation, text: string): number {
  const id = operation.id.toLowerCase();
  let value = 0;
  for (const { pattern, fragments } of SPECIFIC) if (pattern.test(text) && fragments.some((fragment) => id.includes(fragment))) value += 24;
  for (const { pattern, fragments } of NOUNS) if (pattern.test(text) && fragments.some((fragment) => id.includes(fragment))) value += 8;
  const firstAction = ACTIONS.map(({ pattern }) => text.search(pattern)).reduce((best, index, action) => (index >= 0 && (best.index < 0 || index < best.index) ? { action, index } : best), { action: -1, index: -1 });
  for (const [index, { pattern, fragments }] of ACTIONS.entries()) {
    if (pattern.test(text) && fragments.some((fragment) => id.includes(fragment))) value += 4 + (index === firstAction.action ? 8 : 0);
  }
  if (operation.method === 'GET' && /查看|读取|查询|列表|详情|展示|搜索|筛选/.test(text)) value += 2;
  if (operation.method !== 'GET' && /创建|更新|修改|发布|撤销|取消|审批|绑定|退款|发货/.test(text)) value += 2;
  return value;
}

function term(pattern: RegExp, fragments: readonly string[]): Readonly<{ pattern: RegExp; fragments: readonly string[] }> {
  return Object.freeze({ pattern, fragments: Object.freeze(fragments) });
}
