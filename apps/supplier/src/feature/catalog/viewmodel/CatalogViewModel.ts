import { actionField, optionalText, requiredFile, requiredText, type ActionInput, type OperatorAction } from '@shop/presentation/actions';
import { operatorCollection, operatorItems, operatorNumber, operatorRecord, operatorRow, operatorText, selectedOperatorRecord, type OperatorRecord } from '@shop/presentation/operator';
import { PRODUCT_TYPE_OPTIONS, presentProductType, type ProductType } from '@shop/presentation';
import { resolveRoutePath } from '../../../generated/RouteBinding';
import { uploadImportFile } from '@shop/sdk/files';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const catalogViewModel = defineSupplierViewModel({
  routes: ['suppliercatalog', 'supplierproduct'],
  title: '商品提交',
  description: '维护本供应商商品草稿并提交平台审核；平台上架状态和其他供应商数据不可修改。',
  read: (client, context, route) =>
    route.id === 'supplierproduct' ? client.catalog.productDetailRead({ path: { productid: route.parameters.productId }, query: { section: 'core' } }, context) : client.catalog.listingsRead({ query: { limit: 50 } }, context),
  project: (value, route) => (route.id === 'supplierproduct' ? productProjection(value) : catalogProjection(value)),
  actions: (value, route, selectedKey) => (route.id === 'supplierproduct' ? productActions(operatorRecord(value)) : catalogActions(selectedOperatorRecord(value, selectedKey))),
  execute: async (client, context, route, value, selectedKey, action, input) => {
    if (route.id === 'suppliercatalog') {
      if (action.id === 'import') {
        const uploaded = await uploadImportFile(client.runtime, context, requiredFile(input, 'file'));
        const data = await client.catalog.importsCreate({ body: { objectRef: uploaded.objectRef, sha256: uploaded.sha256, fileName: uploaded.fileName } }, context);
        return { message: `商品导入任务已创建，共识别 ${data.total_count} 行。`, data, refresh: false };
      }
      if (action.id === 'importstatus') {
        const data = await client.catalog.importsRead({ path: { importid: requiredText(input, 'job', 255) } }, context);
        return { message: '已同步商品导入任务的最新状态。', data, refresh: false };
      }
      if (action.id === 'create') {
        const description = optionalText(input, 'description', 2000);
        const created = await client.catalog.productsCreate(
          {
            body: {
              category: requiredText(input, 'category', 255),
              title: requiredText(input, 'title', 300),
              type: productType(input),
              ...(description === undefined ? {} : { attributes: { description } }),
            },
          },
          context
        );
        return { message: '商品草稿已创建，请继续完善并提交审核。', destination: productPath(route.parameters, created.id), refresh: false };
      }
      const selected = selectedOperatorRecord(value, selectedKey);
      const product = selected && operatorText(selected, 'product_id');
      if (action.id !== 'open' || !product) throw new Error('该来源商品尚未完成平台映射，暂不能编辑。');
      return { message: '已打开商品详情。', destination: productPath(route.parameters, product), refresh: false };
    }
    if (route.id !== 'supplierproduct') throw new Error('商品路由无效。');
    const product = operatorRecord(value);
    const version = product && operatorNumber(product, 'version');
    if (!product || version === undefined) throw new Error('商品版本不可用，请刷新后重试。');
    if (action.id === 'submit' && operatorText(product, 'status') === 'draft') {
      await client.catalog.productsUpdate({ path: { productid: route.parameters.productId }, body: { status: 'review' } }, { ...context, expectedVersion: version });
      return { message: '商品已提交平台审核。审核通过后由平台决定发布范围。' };
    }
    if (action.id === 'edit' && ['draft', 'review'].includes(operatorText(product, 'status'))) {
      await client.catalog.productsUpdate(
        {
          path: { productid: route.parameters.productId },
          body: {
            title: requiredText(input, 'title', 300),
            category: requiredText(input, 'category', 255),
            attributes: productAttributes(input),
          },
        },
        { ...context, expectedVersion: version }
      );
      return { message: '商品资料已保存。' };
    }
    throw new Error('当前商品状态不允许执行此操作。');
  },
});

function catalogActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  const create = Object.freeze({
    id: 'create',
    label: '新建商品',
    description: '创建仅属于当前供应商的商品草稿。',
    tone: 'primary' as const,
    fields: Object.freeze([
      actionField('title', '商品名称', { maximumLength: 300 }),
      actionField('category', '商品分类名称或编号'),
      actionField('type', '商品类型', { kind: 'choice', value: 'physical', choices: PRODUCT_TYPE_OPTIONS }),
      actionField('description', '商品说明', { kind: 'textarea', required: false, maximumLength: 2000 }),
    ]),
  });
  const imports = [
    Object.freeze({
      id: 'import',
      label: '批量导入商品',
      description: '上传 CSV/XLSX 创建可追踪的商品导入任务。',
      confirmation: '上传完成不代表导入完成，请使用任务编号查询服务端处理结果。',
      tone: 'primary' as const,
      fields: Object.freeze([actionField('file', '商品文件', { kind: 'file' })]),
    }),
    Object.freeze({ id: 'importstatus', label: '查询导入结果', description: '查看商品导入成功、失败和错误报告。', tone: 'secondary' as const, fields: Object.freeze([actionField('job', '导入任务编号')]) }),
  ];
  const product = item && operatorText(item, 'product_id');
  const open = product ? [Object.freeze({ id: 'open', label: '查看与编辑', description: '进入商品详情并维护可编辑资料。', tone: 'secondary' as const, requiresSelection: true, fields: Object.freeze([]) })] : [];
  return Object.freeze([create, ...imports, ...open]);
}

function productActions(item: OperatorRecord | undefined): readonly OperatorAction[] {
  if (!item || !['draft', 'review'].includes(operatorText(item, 'status'))) return Object.freeze([]);
  const version = operatorNumber(item, 'version');
  if (version === undefined) return Object.freeze([]);
  const edit = Object.freeze({
    id: 'edit',
    label: '保存商品资料',
    description: '修改名称、分类和展示信息。',
    tone: 'primary' as const,
    expectedVersion: version,
    fields: Object.freeze([
      actionField('title', '商品名称', { maximumLength: 300, value: operatorText(item, 'title') }),
      actionField('category', '商品分类名称或编号', { value: operatorText(item, 'category_id') }),
      actionField('description', '商品说明', { kind: 'textarea', required: false, maximumLength: 2000, value: operatorText(item, 'description') }),
      actionField('cover', '封面图片地址', { required: false, maximumLength: 1000, value: operatorText(item, 'cover_url') }),
      actionField('subtitle', '商品副标题', { required: false, maximumLength: 300, value: operatorText(item, 'subtitle') }),
    ]),
  });
  const submit =
    operatorText(item, 'status') === 'draft'
      ? [
          Object.freeze({
            id: 'submit',
            label: '提交平台审核',
            description: '锁定当前版本并交由平台审核，不会直接上架。',
            confirmation: '确认商品资料完整。提交后平台将进行审核，但不会自动发布。',
            tone: 'primary' as const,
            expectedVersion: version,
            fields: Object.freeze([]),
          }),
        ]
      : [];
  return Object.freeze([edit, ...submit]);
}

function catalogProjection(value: unknown) {
  const items = operatorItems(value);
  if (items.length === 0) {
    const job = operatorRecord(value);
    const id = job && operatorText(job, 'id');
    if (id)
      return operatorCollection(value, [
        operatorRow({
          key: id,
          title: `商品导入 ${id}`,
          detail: `总计 ${operatorNumber(job!, 'total_count') ?? 0} · 成功 ${operatorNumber(job!, 'success_count') ?? 0} · 失败 ${operatorNumber(job!, 'failure_count') ?? 0}`,
          statusLabel: importStatus(operatorText(job!, 'state')),
          timestamp: operatorText(job!, 'updated_at'),
        }),
      ]);
  }
  return operatorCollection(
    value,
    items.map((item) =>
      operatorRow({
        key: operatorText(item, 'id'),
        title: operatorText(item, 'title'),
        detail: `${operatorText(item, 'code') || '编码待映射'} · ${operatorText(item, 'category_name') || '分类待完善'} · ${sourceLabel(operatorText(item, 'source'))}`,
        statusLabel: productStatus(operatorText(item, 'status')),
        timestamp: operatorText(item, 'cursor_sort'),
      })
    )
  );
}

function productProjection(value: unknown) {
  const item = operatorRecord(value);
  if (!item) return operatorCollection(value, []);
  return operatorCollection(value, [
    operatorRow({
      key: operatorText(item, 'id'),
      title: operatorText(item, 'title'),
      detail: `${typeLabel(operatorText(item, 'product_type'))} · 分类 ${operatorText(item, 'category_id')}`,
      statusLabel: productStatus(operatorText(item, 'status')),
      timestamp: operatorText(item, 'updatedAt'),
    }),
  ]);
}

function productAttributes(input: ActionInput) {
  const description = optionalText(input, 'description', 2000);
  const coverUrl = optionalText(input, 'cover', 1000);
  const subtitle = optionalText(input, 'subtitle', 300);
  return Object.freeze({ ...(description ? { description } : {}), ...(coverUrl ? { coverUrl } : {}), ...(subtitle ? { subtitle } : {}) });
}

function productType(input: ActionInput): ProductType {
  const value = requiredText(input, 'type');
  if (!PRODUCT_TYPE_OPTIONS.some((item) => item.value === value)) throw new Error('请选择有效的商品类型。');
  return value as ProductType;
}

function productPath(parameters: Readonly<Record<string, string>>, productId: string): string {
  return resolveRoutePath('supplierproduct', { scopeKind: parameters.scopeKind!, scopeId: parameters.scopeId!, productId });
}

function sourceLabel(value: string): string {
  return value === 'self' ? '本地商品' : value ? `${value} 渠道` : '来源待确认';
}
function typeLabel(value: string): string {
  return presentProductType(value);
}
function productStatus(value: string): string {
  if (value === 'draft') return '草稿';
  if (value === 'review' || value === 'pending') return '平台审核中';
  if (value === 'active' || value === 'published' || value === 'mapped') return '已生效';
  if (value === 'archived' || value === 'retired') return '已归档';
  return '状态待同步';
}
function importStatus(value: string): string {
  return value === 'completed' ? '导入完成' : value === 'failed' || value === 'rejected' ? '导入失败' : value === 'running' ? '正在导入' : '等待处理';
}
