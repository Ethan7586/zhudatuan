import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import { MetricReader } from '../service/MetricReader';

export const CustomerMemberPreset = Object.freeze({
  code: 'customermember' as const,
  name: '客户 / 会员分层',
  description: '在当前授权客户范围内，按购买会员汇总成交金额与支付订单；界面默认脱敏会员标识。',
  dimensions: Object.freeze(['customer', 'member'] as const),
  privacy: 'masked' as const,
  version: 1,
  owner: 'reporting' as const,
});

export class DimensionsReadHandler {
  constructor(private readonly metrics: MetricReader) {}

  async readCustomerMembers(
    input: OperationInputFor<'reporting.sales.read'>,
    context: HandlerContext<'reporting.sales.read'>,
  ): Promise<OperationReply<OperationOutputFor<'reporting.sales.read'>>> {
    const response = await this.metrics.read('reporting.sales.read', input, context, 'member');
    return {
      status: response.status,
      body: Object.freeze({ ...response.body, preset: CustomerMemberPreset }) as unknown as OperationOutputFor<'reporting.sales.read'>,
    };
  }
}
