import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { MetricReader } from '../service/MetricReader';
import { DimensionsReadHandler } from './DimensionsReadHandler';

export class SalesReadHandler implements OperationHandler<'reporting.sales.read', 'read'> {
  readonly operation = 'reporting.sales.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader, private readonly dimensions = new DimensionsReadHandler(metrics)) {}
  async execute(input: OperationInputFor<'reporting.sales.read'>, context: HandlerContext<'reporting.sales.read'>): Promise<OperationReply<OperationOutputFor<'reporting.sales.read'>>> {
    const preset = input.query?.dimensionpreset;
    if (preset === 'customermember') return this.dimensions.readCustomerMembers(input, context);
    if (preset !== undefined) throw new Error('REPORT_DIMENSION_PRESET_INVALID');
    const response = await this.metrics.read(this.operation, input, context, 'sales');
    return { status: response.status, body: Object.freeze({ ...response.body, preset: null }) as OperationOutputFor<'reporting.sales.read'> };
  }
}
