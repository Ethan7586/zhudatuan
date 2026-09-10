import type { ProductRestockStage } from '../application/RestockProduct';
import type { ProductStockSource } from '../model/Product';

export function productStockLocation(source: ProductStockSource, index: number): string {
  const reference = source.reference?.trim();
  if (reference && !technicalIdentity(reference)) return reference;
  if (/main|primary|central|default/i.test(source.location)) return '主仓';
  return `库存地点 ${index + 1}`;
}

export function productStockStage(stage: ProductRestockStage | undefined): string {
  if (stage === 'uploading') return '正在创建库存任务…';
  if (stage === 'validating') return '正在校验商品与库存数量…';
  if (stage === 'applying') return '正在写入库存账本…';
  if (stage === 'completed') return '库存已补充，商品数据正在刷新。';
  return '';
}

function technicalIdentity(value: string): boolean {
  return value.includes(':') || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}
