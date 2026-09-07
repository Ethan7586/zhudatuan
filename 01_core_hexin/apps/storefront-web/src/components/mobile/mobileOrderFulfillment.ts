import type { FrontendOrder } from '../../adapters/frontendData';
import type { MobileFulfillmentStage } from '../../context/MallContext';

const STAGE_LABELS: Record<MobileFulfillmentStage, string> = {
  processing: '待处理',
  shipped: '已发货',
  received: '已收货',
};

export interface MobileFulfillmentSummary {
  count: number;
  stage: MobileFulfillmentStage;
  label: string;
}

export function mobileFulfillmentStageForStatus(status: FrontendOrder['status']): MobileFulfillmentStage | null {
  if (status === 'pending_shipment' || status === 'paid') return 'processing';
  if (status === 'pending_receipt' || status === 'shipping' || status === 'shipped') return 'shipped';
  return null;
}

export function summarizeMobileFulfillment(
  orders: readonly FrontendOrder[],
  simulatedStage: MobileFulfillmentStage | null,
): MobileFulfillmentSummary {
  const activeStages = orders
    .map((order) => mobileFulfillmentStageForStatus(order.status))
    .filter((stage): stage is MobileFulfillmentStage => stage !== null);
  const stage = activeStages.length === 0
    ? 'processing'
    : simulatedStage ?? resolvePriorityStage(activeStages);

  return {
    count: activeStages.length,
    stage,
    label: STAGE_LABELS[stage],
  };
}

export function effectiveMobileFulfillmentStage(
  order: FrontendOrder,
  simulatedStage: MobileFulfillmentStage | null,
): MobileFulfillmentStage | null {
  const actualStage = mobileFulfillmentStageForStatus(order.status);
  return actualStage === null ? null : simulatedStage ?? actualStage;
}

export function mobileFulfillmentStageLabel(stage: MobileFulfillmentStage): string {
  return STAGE_LABELS[stage];
}

export function nextMobileFulfillmentStage(stage: MobileFulfillmentStage): MobileFulfillmentStage {
  if (stage === 'processing') return 'shipped';
  if (stage === 'shipped') return 'received';
  return 'processing';
}

export function mobileFulfillmentSimulationAction(stage: MobileFulfillmentStage): string {
  if (stage === 'processing') return '模拟后台发货';
  if (stage === 'shipped') return '模拟确认收货';
  return '重新演示';
}

function resolvePriorityStage(stages: readonly MobileFulfillmentStage[]): MobileFulfillmentStage {
  if (stages.includes('processing')) return 'processing';
  if (stages.includes('shipped')) return 'shipped';
  return 'received';
}
