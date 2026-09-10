import { actionField, requiredFile, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { operatorCollection, operatorItems, operatorNumber, operatorRecord, operatorRow, operatorText } from '@shop/presentation/operator';
import { uploadImportFile } from '@shop/sdk/files';
import { defineSupplierViewModel } from '../../../shared/FeatureViewModel';

export const inventoryViewModel = defineSupplierViewModel({
  routes: ['supplierinventory'],
  title: '库存同步',
  description: '按商品编码查询平台权威库存，或上传 CSV/XLSX 批量同步；上传成功不等于导入完成。',
  read: (client, context) => client.inventory.availabilityRead({ query: {} }, context),
  project: inventoryProjection,
  actions: () => inventoryActions,
  execute: async (client, context, _route, _value, _selectedKey, action, input) => {
    if (action.id === 'lookup') {
      const data = await client.inventory.availabilityRead({ query: { sku: requiredText(input, 'sku', 255) } }, context);
      return { message: data.count === 0 ? '未找到该商品的库存记录。' : '已同步平台权威库存。', data, refresh: false };
    }
    if (action.id === 'import') {
      const uploaded = await uploadImportFile(client.runtime, context, requiredFile(input, 'file'));
      const data = await client.inventory.importsCreate({ body: { objectRef: uploaded.objectRef, sha256: uploaded.sha256, fileName: uploaded.fileName } }, context);
      return { message: `导入任务已创建，共识别 ${data.total_count} 行；请继续查询任务结果。`, data, refresh: false };
    }
    if (action.id === 'status') {
      const data = await client.inventory.importsRead({ query: { job: requiredText(input, 'job', 255) } }, context);
      return { message: '已同步导入任务的最新状态。', data, refresh: false };
    }
    throw new Error('未知库存操作。');
  },
});

const inventoryActions: readonly OperatorAction[] = Object.freeze([
  Object.freeze({ id: 'lookup', label: '查询库存', description: '按平台商品编码读取在手、预占和可售数量。', tone: 'secondary', fields: Object.freeze([actionField('sku', '商品编码')]) }),
  Object.freeze({
    id: 'import',
    label: '上传库存文件',
    description: '校验并加密上传 CSV/XLSX，再创建可追踪的导入任务。',
    confirmation: '文件上传后由服务端异步校验和写入；页面不会把“已上传”误报为“已完成”。',
    tone: 'primary',
    fields: Object.freeze([actionField('file', '库存文件', { kind: 'file' })]),
  }),
  Object.freeze({ id: 'status', label: '查询导入结果', description: '使用导入任务编号查看成功、失败和错误报告。', tone: 'secondary', fields: Object.freeze([actionField('job', '导入任务编号')]) }),
]);

function inventoryProjection(value: unknown) {
  const items = operatorItems(value);
  if (items.length > 0)
    return operatorCollection(
      value,
      items.map((item) =>
        operatorRow({
          key: operatorText(item, 'sku'),
          title: `商品 ${operatorText(item, 'sku')}`,
          detail: `在手 ${count(item, 'onhand')} · 预占 ${count(item, 'reserved')} · 安全库存 ${count(item, 'safety')} · 可售 ${count(item, 'available')}`,
          statusLabel: inventoryStatus(operatorText(item, 'state')),
          timestamp: operatorText(item, 'watermark'),
        })
      )
    );
  const job = operatorRecord(value);
  const id = job && operatorText(job, 'id');
  return operatorCollection(
    value,
    id
      ? [
          operatorRow({
            key: id,
            title: `库存导入 ${id}`,
            detail: `总计 ${count(job!, 'total_count')} · 成功 ${count(job!, 'success_count')} · 失败 ${count(job!, 'failure_count')}`,
            statusLabel: importStatus(operatorText(job!, 'state')),
            timestamp: operatorText(job!, 'updated_at'),
          }),
        ]
      : []
  );
}

function count(item: Parameters<typeof operatorText>[0], key: string): number {
  return operatorNumber(item, key) ?? 0;
}
function inventoryStatus(value: string): string {
  return value === 'available' ? '库存可售' : value === 'blocked' ? '库存已冻结' : '当前不可售';
}
function importStatus(value: string): string {
  if (value === 'completed') return '导入完成';
  if (value === 'failed' || value === 'rejected') return '导入失败';
  if (value === 'running') return '正在导入';
  return '等待处理';
}
