import * as Operation from '@shop/contract/ids';
import type { VoucherChoiceKind, VoucherOperation, VoucherView } from './Voucher';

export interface VoucherField {
  readonly key: string;
  readonly label: string;
  readonly type: 'text' | 'number' | 'datetime' | 'select' | 'checkbox';
  readonly required?: boolean;
  readonly hint?: string;
  readonly source?: VoucherChoiceKind;
  readonly options?: readonly Readonly<{ value: string; label: string }>[];
  readonly initial?: string;
}
export interface VoucherOperationMeta {
  readonly label: string;
  readonly description: string;
  readonly targetLabel?: string;
  readonly expectedVersion?: boolean;
  readonly proof?: boolean;
  readonly fields: readonly VoucherField[];
}

export const voucherReadOperations: ReadonlySet<VoucherOperation> = new Set([
  Operation.OP_VOUCHER_PRODUCTS_GET, Operation.OP_VOUCHER_PRODUCTS_LIST, Operation.OP_VOUCHER_PRODUCTOPTIONS_LIST,
  Operation.OP_VOUCHER_CREDENTIALPOOLS_GET, Operation.OP_VOUCHER_CREDENTIALPOOLS_LIST, Operation.OP_VOUCHER_CREDENTIALS_LIST,
  Operation.OP_VOUCHER_CREDENTIALS_GET, Operation.OP_VOUCHER_JOBS_GET, Operation.OP_VOUCHER_STOCKREQUESTS_GET,
  Operation.OP_VOUCHER_STOCKREQUESTS_LIST, Operation.OP_VOUCHER_STOCKREQUESTOPTIONS_LIST, Operation.OP_VOUCHER_ISSUEORDERS_GET,
  Operation.OP_VOUCHER_ISSUEORDERS_LIST, Operation.OP_VOUCHER_ISSUEBATCHES_GET, Operation.OP_VOUCHER_ACTIONBATCHES_GET,
  Operation.OP_VOUCHER_ACTIONBATCHES_LIST, Operation.OP_VOUCHER_SEARCH_READ, Operation.OP_VOUCHER_VOUCHERS_GET,
  Operation.OP_VOUCHER_VOUCHERS_GETBYNUMBER, Operation.OP_VOUCHER_VOUCHERS_TIMELINE, Operation.OP_VOUCHER_REDEMPTIONS_GET,
  Operation.OP_VOUCHER_SEARCHFACETS_READ, Operation.OP_VOUCHER_EXPORTS_GET,
]);

const text = (key: string, label: string, hint?: string): VoucherField => ({ key, label, type: 'text', required: true, ...(hint ? { hint } : {}) });
const reference = (key: string, label: string, source: VoucherChoiceKind, hint?: string): VoucherField => ({ key, label, type: 'select', required: true, source, ...(hint ? { hint } : {}) });
const number = (key: string, label: string, initial = '1'): VoucherField => ({ key, label, type: 'number', required: true, initial });
const reason = text('reason', '操作原因', '请填写可供审计理解的完整原因，至少 2 个字。');
const validity: readonly VoucherField[] = [
  { key: 'startsAt', label: '开始时间', type: 'datetime', required: true },
  { key: 'expiresAt', label: '结束时间', type: 'datetime', required: true },
];
const product: readonly VoucherField[] = [text('customer', '卡券客户编号'), text('name', '产品名称'), number('face', '面值（元）', '10'), text('qualification', '资格规则编号'), text('pool', '商品池编号（可选）'), ...validity,
  { key: 'activation', label: '激活方式', type: 'select', required: true, initial: 'automatic', options: [{ value: 'automatic', label: '自动激活' }, { value: 'secret', label: '密钥激活' }, { value: 'numbersecret', label: '卡号和密钥激活' }] },
  { key: 'approval', label: '发放前需要审批', type: 'checkbox', initial: 'true' }];
const stock: readonly VoucherField[] = [text('customer', '卡券客户编号'), reference('product', '卡券产品', 'product', '显示当前范围内可用产品；选择后自动提交权威产品编号。'), text('pool', '卡号库编号'), number('quantity', '申请数量'), reason];
const issue: readonly VoucherField[] = [text('customer', '卡券客户编号'), text('product', '卡券产品编号'), reference('stockRequest', '已审批库存申请', 'stock', '只显示当前范围可发库存；选择后自动带入客户、产品和卡号库。'), number('quantity', '发放数量'),
  { key: 'purpose', label: '发放用途', type: 'select', required: true, initial: 'benefit', options: [{ value: 'benefit', label: '福利发放' }, { value: 'order', label: '订单履约' }, { value: 'campaign', label: '活动发放' }, { value: 'manual', label: '人工发放' }] },
  { key: 'delivery', label: '领取方式', type: 'select', required: true, initial: 'account', options: [{ value: 'account', label: '直接到账' }, { value: 'claim', label: '领取码' }] }, ...validity, text('recipient', '接收对象快照编号'), reason];

export const voucherOperations: Readonly<Partial<Record<VoucherOperation, VoucherOperationMeta>>> = Object.freeze({
  [Operation.OP_VOUCHER_PRODUCTS_CREATE]: { label: '新建卡券产品', description: '定义面值、资格、有效期和激活方式。', fields: product },
  [Operation.OP_VOUCHER_PRODUCTS_REVISE]: { label: '修订产品版本', description: '关键字段以新版本生效，历史版本保留。', targetLabel: '卡券产品编号', expectedVersion: true, fields: product },
  [Operation.OP_VOUCHER_PRODUCTS_ENABLE]: { label: '启用卡券产品', description: '启用前会校验客户、资格、卡号库和有效期。', targetLabel: '卡券产品编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_PRODUCTS_DISABLE]: { label: '停用卡券产品', description: '停止新增供给，既有事实仍保留。', targetLabel: '卡券产品编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_CREDENTIALPOOLS_CREATE]: { label: '新建卡号库', description: '建立系统生成或安全导入的凭证池。', fields: [reference('product', '卡券产品', 'product', '显示当前范围内可建库的产品。'), text('name', '卡号库名称'), { key: 'mode', label: '凭证来源', type: 'select', required: true, initial: 'generated', options: [{ value: 'generated', label: '系统生成' }, { value: 'imported', label: '安全导入' }] }, text('prefix', '卡号前缀'), number('capacity', '最大容量', '1000')] },
  [Operation.OP_VOUCHER_CREDENTIALPOOLS_CLOSE]: { label: '关闭卡号库', description: '关闭后只读，不再生成或分配凭证。', targetLabel: '卡号库编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_CREDENTIALS_GENERATE]: { label: '生成凭证', description: '创建可断点、可重试的后台生成任务。', targetLabel: '卡号库编号', fields: [number('count', '生成数量', '100')] },
  [Operation.OP_VOUCHER_CREDENTIALS_IMPORT]: { label: '安全导入凭证', description: '进入统一导入向导，安全上传 CSV 或 XLSX，经服务端预检确认后执行。', targetLabel: '卡号库编号', fields: [] },
  [Operation.OP_VOUCHER_CREDENTIALEXPORTS_CREATE]: { label: '导出明文凭证', description: '高敏感操作：双人审批、短时效、一次下载。', fields: [text('pool', '卡号库编号'), reason, text('watermark', '数据水位（ISO 时间）')], proof: true, expectedVersion: true },
  [Operation.OP_VOUCHER_STOCKREQUESTS_CREATE]: { label: '新建库存申请', description: '申请指定客户、产品和卡号库的可发库存。', fields: stock },
  [Operation.OP_VOUCHER_STOCKREQUESTS_UPDATE]: { label: '编辑库存申请', description: '只有草稿可修改。', targetLabel: '库存申请编号', expectedVersion: true, fields: stock },
  [Operation.OP_VOUCHER_STOCKREQUESTS_SUBMIT]: { label: '提交库存申请', description: '提交后冻结并进入统一审批。', targetLabel: '库存申请编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_STOCKREQUESTS_CANCEL]: { label: '取消库存申请', description: '仅未决定的申请可以取消。', targetLabel: '库存申请编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_ISSUEORDERS_CREATE]: { label: '新建发放单', description: '冻结客户、用途、数量、有效期和领取方式。', fields: issue },
  [Operation.OP_VOUCHER_ISSUEORDERS_UPDATE]: { label: '编辑发放单', description: '只有草稿可修改。', targetLabel: '发放单编号', expectedVersion: true, fields: issue },
  [Operation.OP_VOUCHER_ISSUEORDERS_SUBMIT]: { label: '提交发放单', description: '进入审批；通过后自动创建发放批次。', targetLabel: '发放单编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_ISSUEORDERS_CANCEL]: { label: '取消发放单', description: '仅未开始执行的发放单可取消。', targetLabel: '发放单编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_ISSUEBATCHES_RETRY]: { label: '重试发放批次', description: '只处理可重试失败项，已成功项不会重复。', targetLabel: '发放批次编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_ISSUEORDEREXPORTS_CREATE]: { label: '导出发放结果', description: '只包含脱敏状态和业务编号。', fields: [text('order', '发放单编号'), reason] },
  [Operation.OP_VOUCHER_ACTIONBATCHES_CREATE]: { label: '新建批量操作', description: '基于冻结搜索快照逐券执行并保留收据。', fields: [text('snapshot', '搜索快照编号'), { key: 'action', label: '操作', type: 'select', required: true, initial: 'disable', options: [{ value: 'activate', label: '激活' }, { value: 'disable', label: '停用' }, { value: 'enable', label: '恢复' }, { value: 'void', label: '作废' }, { value: 'extend', label: '延期' }] }, reason, { key: 'expiresAt', label: '延期后结束时间（仅延期）', type: 'datetime' }] },
  [Operation.OP_VOUCHER_ACTIONBATCHES_RETRY]: { label: '重试批量操作', description: '只重试可恢复失败项。', targetLabel: '操作批次编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_ACTIONEXPORTS_CREATE]: { label: '导出操作结果', description: '导出逐项状态，不包含任何密钥。', fields: [text('batch', '操作批次编号'), reason] },
  [Operation.OP_VOUCHER_ACTIVATIONS_SECRET]: { label: '使用密钥激活', description: '统一防枚举与尝试次数限制。', fields: [text('secret', '激活密钥')] },
  [Operation.OP_VOUCHER_ACTIVATIONS_NUMBERSECRET]: { label: '使用卡号和密钥激活', description: '卡号与密钥同时匹配后激活。', fields: [text('number', '完整卡号'), text('secret', '激活密钥')] },
  [Operation.OP_VOUCHER_VOUCHERS_BIND]: { label: '绑定持有人', description: '把未持有的卡券绑定到范围内有效成员。', targetLabel: '卡券编号', expectedVersion: true, fields: [text('member', '成员编号'), reason] },
  [Operation.OP_VOUCHER_VOUCHERS_UNBIND]: { label: '解绑持有人', description: '只允许未消费且规则许可的卡券。', targetLabel: '卡券编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_REDEMPTIONS_QUOTE]: { label: '核销试算', description: '仅校验可用性和余额，不执行核销。', fields: [text('voucher', '卡券编号'), number('amount', '核销金额（元）'), text('order', '订单编号（可选）')] },
  [Operation.OP_VOUCHER_TENDERHOLDS_CREATE]: { label: '创建核销冻结', description: '短时冻结金额，避免并发重复核销。', fields: [text('voucher', '卡券编号'), text('owner', '冻结方编号'), number('amount', '冻结金额（元）'), number('ttl', '有效秒数', '300')] },
  [Operation.OP_VOUCHER_TENDERHOLDS_CONSUME]: { label: '提交冻结核销', description: '消费有效冻结并生成唯一核销回执。', targetLabel: '冻结编号', fields: [text('verification', '核验令牌'), text('order', '订单编号（可选）')] },
  [Operation.OP_VOUCHER_TENDERHOLDS_RELEASE]: { label: '释放核销冻结', description: '释放后金额恢复可用。', targetLabel: '冻结编号', expectedVersion: true, fields: [reason] },
  [Operation.OP_VOUCHER_REDEMPTIONS_CREATE]: { label: '确认核销', description: '消费有效冻结并生成核销回执；核销金额必须与冻结金额一致。', fields: [text('voucher', '卡券编号'), text('hold', '冻结编号'), text('verification', '核验记录编号'), number('amount', '核销金额（元）'), text('order', '订单编号（可选）')] },
  [Operation.OP_VOUCHER_REFUNDS_CREATE]: { label: '卡券退款', description: '累计退款不得超过原核销金额。', targetLabel: '核销回执编号', fields: [number('amount', '退款金额（元）'), reason] },
  [Operation.OP_VOUCHER_SEARCHSNAPSHOTS_CREATE]: { label: '冻结搜索结果', description: '固定筛选条件、数据水位和结果数量。', fields: [text('query', '搜索词（可选）'), text('product', '产品编号（可选）'), text('pool', '卡号库编号（可选）'), text('customer', '客户编号（可选）'), text('holder', '持有人编号（可选）'), text('state', '状态（可选）')] },
  [Operation.OP_VOUCHER_SEARCHEXPORTS_CREATE]: { label: '导出搜索结果', description: '从冻结快照生成可恢复导出任务。', fields: [text('snapshot', '搜索快照编号'), reason] },
});

export const voucherPrimaryOperations: Readonly<Record<VoucherView, readonly VoucherOperation[]>> = Object.freeze({
  products: [Operation.OP_VOUCHER_PRODUCTS_CREATE], pools: [Operation.OP_VOUCHER_CREDENTIALPOOLS_CREATE], credentials: [Operation.OP_VOUCHER_CREDENTIALS_GENERATE, Operation.OP_VOUCHER_CREDENTIALS_IMPORT, Operation.OP_VOUCHER_CREDENTIALEXPORTS_CREATE],
  stocks: [Operation.OP_VOUCHER_STOCKREQUESTS_CREATE], issues: [Operation.OP_VOUCHER_ISSUEORDERS_CREATE, Operation.OP_VOUCHER_ISSUEORDEREXPORTS_CREATE], vouchers: [Operation.OP_VOUCHER_ACTIVATIONS_SECRET, Operation.OP_VOUCHER_ACTIVATIONS_NUMBERSECRET, Operation.OP_VOUCHER_REDEMPTIONS_QUOTE],
  redemptions: [Operation.OP_VOUCHER_REDEMPTIONS_CREATE], actions: [Operation.OP_VOUCHER_ACTIONBATCHES_CREATE], search: [Operation.OP_VOUCHER_SEARCHSNAPSHOTS_CREATE, Operation.OP_VOUCHER_SEARCHEXPORTS_CREATE],
});

export function voucherOperationMeta(operation: VoucherOperation): VoucherOperationMeta {
  const meta = voucherOperations[operation];
  if (!meta) throw new Error(`VOUCHER_OPERATION_FORM_MISSING:${operation}`);
  return meta;
}
