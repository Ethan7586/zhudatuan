import { RUNTIME_TASK_STATES, type OperationOutputFor } from '@shop/contract';

export type ProductImportState = OperationOutputFor<'runtime.imports.read'>['state'];

export type ProductImportStateView = Readonly<{
  title: string;
  active: boolean;
  failed: boolean;
}>;

const stateViews: Readonly<Record<ProductImportState, ProductImportStateView>> = Object.freeze({
  queued: state('商品导入正在排队', true),
  validating: state('商品文件正在校验', true),
  ready: state('商品文件等待确认', false),
  running: state('商品导入正在执行', true),
  completed: state('商品导入已完成', false),
  failed: state('商品导入存在失败项', false, true),
  cancelled: state('商品导入已取消', false),
  expired: state('商品导入凭证已过期', false, true),
});

const issueViews: Readonly<Record<string, string>> = Object.freeze({
  CATALOG_SPU_REQUIRED: '请填写 SPU 编码',
  CATALOG_SPU_INVALID: 'SPU 编码格式不正确',
  CATALOG_TITLE_REQUIRED: '请填写商品名称',
  CATALOG_SKU_REQUIRED: '请填写 SKU 编码',
  VALIDATION_FAILED: 'SKU 编码格式不正确',
  CATALOG_CATEGORY_REQUIRED: '请填写类目',
  CATALOG_CATEGORY_UNKNOWN: '找不到对应类目',
  CATALOG_CATEGORY_AMBIGUOUS: '类目名称不唯一，请使用类目编码',
  CATALOG_CATEGORY_DISABLED: '该类目已停用',
  CATALOG_SUPPLIER_INVALID: '供应商标识格式不正确',
  CATALOG_SUPPLIER_UNKNOWN: '供应商不存在或已停用',
  CATALOG_PRODUCT_TYPE_INVALID: '商品类型不正确',
  CATALOG_IMAGES_INVALID: '图片地址格式不正确',
  CATALOG_ATTRIBUTES_INVALID: '商品属性格式不正确',
  CATALOG_SPECIFICATIONS_INVALID: 'SKU 规格格式不正确',
  CATALOG_ATTRIBUTE_REQUIRED: '缺少类目必填属性',
  CATALOG_QUALIFICATION_BLOCKED: '不满足当前范围的经营资格要求',
});

const fieldViews: Readonly<Record<string, string>> = Object.freeze({
  spu: 'SPU',
  title: '商品名称',
  sku: 'SKU',
  category: '类目',
  supplier: '供应商',
  type: '商品类型',
  images: '图片',
  attributes: '商品属性',
  specifications: 'SKU 规格',
});

export function presentProductImportState(value: ProductImportState): ProductImportStateView {
  return stateViews[value];
}

export function isActiveProductImport(value: ProductImportState | undefined): boolean {
  return value !== undefined && RUNTIME_TASK_STATES.includes(value) && stateViews[value].active;
}

export function presentProductImportIssue(code: string): string {
  return issueViews[code] ?? '该行未通过商品校验';
}

export function presentProductImportField(value: string): string {
  return fieldViews[value] ?? '商品字段';
}

export function presentProductImportFailure(_value: string): string {
  return '服务端未能完成本次校验，请更换文件或稍后重试。';
}

function state(title: string, active: boolean, failed = false): ProductImportStateView {
  return Object.freeze({ title, active, failed });
}
