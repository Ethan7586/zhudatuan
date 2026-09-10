import { actionField, requiredSignedInteger, requiredText, type OperatorAction } from '@shop/presentation/actions';
import { defineStoreViewModel } from '../../../shared/FeatureViewModel';
import {
  operatorCollection as displayCollection,
  operatorItems as dataItems,
  operatorNumber as recordNumber,
  operatorRecord as dataRecord,
  operatorRow as displayRow,
  operatorText as recordText,
  type OperatorRecord as DataRecord,
} from '@shop/presentation/operator';

interface InventoryPage {
  readonly mode: 'availability' | 'adjustments';
  readonly page: unknown;
}

const lookupAction = Object.freeze({ id: 'lookup', label: '查询库存', description: '按 SKU 查询服务端实时库存。', tone: 'primary', fields: Object.freeze([actionField('sku', '商品 SKU', { kind: 'scan', maximumLength: 128 })]) } as const);
const historyAction = Object.freeze({ id: 'history', label: '查看调整申请', description: '查看本门店提交的库存调整及审批状态。', tone: 'secondary', fields: Object.freeze([]) } as const);

export const inventoryViewModel = defineStoreViewModel({
  routes: ['storeinventorywork'],
  title: '库存查询与调整申请',
  description: '查询权威在手量、预占量和可用量；调整只提交审批申请，绝不直接修改库存账本。',
  read: async (client, context) => ({ mode: 'adjustments', page: await client.inventory.adjustmentsRead({ query: { limit: 50 } }, context) }) satisfies InventoryPage,
  project: inventoryProjection,
  actions: (value, _route, selectedKey) => inventoryActions(value, selectedKey),
  execute: async (client, context, _route, value, selectedKey, action, input) => {
    if (action.id === 'lookup')
      return { message: '库存查询完成，数据来自服务端实时账本。', data: { mode: 'availability', page: await client.inventory.availabilityRead({ query: { sku: requiredText(input, 'sku', 128) } }, context) } satisfies InventoryPage };
    if (action.id === 'history') return { message: '已切换到库存调整申请记录。', data: { mode: 'adjustments', page: await client.inventory.adjustmentsRead({ query: { limit: 50 } }, context) } satisfies InventoryPage };
    const source = selectedSource(value, selectedKey);
    const version = source && sourceVersion(source);
    if (action.id !== 'adjust' || !source || version === undefined) throw new Error('请先查询 SKU，并选择一个库存地点。');
    const quantityDelta = requiredSignedInteger(input, 'quantity', -1_000_000, 1_000_000);
    if (quantityDelta === 0) throw new Error('调整数量不能为 0。');
    await client.inventory.adjustmentsCreate({ body: { stockitem: recordText(source, 'id'), quantityDelta, reason: requiredText(input, 'reason', 1000), expectedVersion: version } }, { ...context, expectedVersion: version });
    return { message: '库存调整申请已提交审批，当前库存账本没有被直接修改。' };
  },
});

function inventoryActions(value: unknown, selectedKey: string | undefined): readonly OperatorAction[] {
  const source = selectedSource(value, selectedKey);
  const version = source && sourceVersion(source);
  const adjust =
    source && version !== undefined
      ? Object.freeze({
          id: 'adjust',
          label: '申请调整',
          description: '提交带原因的库存调整审批申请。',
          confirmation: '该操作只创建审批申请；审批通过并执行前，库存不会变化。',
          tone: 'danger',
          requiresSelection: true,
          expectedVersion: version,
          fields: Object.freeze([actionField('quantity', '调整数量', { kind: 'number', placeholder: '增加填正数，减少填负数', maximumLength: 16 }), actionField('reason', '调整原因', { kind: 'textarea', maximumLength: 1000 })]),
        } as const)
      : undefined;
  return Object.freeze([lookupAction, historyAction, ...(adjust ? [adjust] : [])]);
}

function inventoryProjection(value: unknown) {
  const state = inventoryPage(value);
  if (state.mode === 'adjustments')
    return displayCollection(
      state.page,
      dataItems(state.page).map((item) =>
        displayRow({
          key: recordText(item, 'id'),
          title: `调整申请 · ${recordText(item, 'sku')}`,
          detail: `${signed(recordNumber(item, 'quantityDelta') ?? 0)} · ${recordText(item, 'reason')}`,
          statusLabel: adjustmentStatus(recordText(item, 'state')),
          timestamp: recordText(item, 'updatedAt'),
        })
      )
    );
  const rows = dataItems(state.page).flatMap((item) => availabilityRows(item));
  return displayCollection(state.page, rows);
}

function availabilityRows(item: DataRecord) {
  const sku = recordText(item, 'sku');
  const sources = Array.isArray(item.sources) ? item.sources.map(dataRecord).filter((source): source is DataRecord => source !== undefined) : [];
  return sources.map((source) =>
    displayRow({
      key: recordText(source, 'id'),
      title: `${sku} · ${recordText(source, 'location')}`,
      detail: `在手 ${recordText(source, 'onhand')} · 预占 ${recordText(source, 'reserved')} · 可用 ${recordText(source, 'available')}`,
      status: recordText(source, 'state'),
      timestamp: recordText(source, 'watermark'),
    })
  );
}

function selectedSource(value: unknown, key: string | undefined): DataRecord | undefined {
  if (key === undefined || inventoryPage(value).mode !== 'availability') return undefined;
  return dataItems(inventoryPage(value).page)
    .flatMap((item) => (Array.isArray(item.sources) ? item.sources : []))
    .map(dataRecord)
    .find((source): source is DataRecord => source !== undefined && recordText(source, 'id') === key);
}

function inventoryPage(value: unknown): InventoryPage {
  const record = dataRecord(value);
  return { mode: record?.mode === 'availability' ? 'availability' : 'adjustments', page: record?.page };
}

function sourceVersion(value: DataRecord): number | undefined {
  const direct = recordNumber(value, 'version');
  if (direct !== undefined) return direct;
  const parsed = Number(recordText(value, 'version'));
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function adjustmentStatus(value: string): string {
  if (value === 'pending') return '待审批';
  if (value === 'approved') return '审批通过';
  if (value === 'rejected') return '审批拒绝';
  if (value === 'applied') return '已执行';
  return value === 'cancelled' ? '已取消' : '状态待确认';
}
