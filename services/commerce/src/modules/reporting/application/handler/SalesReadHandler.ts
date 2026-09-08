import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { MetricReader } from '../service/MetricReader';
import { CUSTOMER_MEMBER_PRESET } from '../../domain/value/DimensionCatalog';

export class SalesReadHandler implements OperationHandler<'reporting.sales.read', 'read'> {
  readonly operation = 'reporting.sales.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  async execute(input: OperationInputFor<'reporting.sales.read'>, context: HandlerContext<'reporting.sales.read'>): Promise<OperationReply<OperationOutputFor<'reporting.sales.read'>>> {
    const preset = input.query?.dimensionpreset;
    if (preset === 'customermember') return this.metrics.read(this.operation, input, context, CUSTOMER_MEMBER_PRESET.reportDimension);
    if (preset !== undefined) throw new Error('REPORT_DIMENSION_PRESET_INVALID');
    return this.metrics.read(this.operation, input, context, 'sales');
  }
}
