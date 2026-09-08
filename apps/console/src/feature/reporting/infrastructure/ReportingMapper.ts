import type { ReportDimensions, ReportExport, ReportPage } from '../model/Report';
import { deepFreeze } from '../../../shared/model/Immutable';
import { ReportDimensionsSchema, ReportExportSchema, ReportMetricPageSchema } from './ReportingSchema';

type ParsedReportPage = Omit<ReportPage, 'nextCursor'> &
  Readonly<{
    nextCursor?: string | undefined;
  }>;

export class ReportingMapper {
  page(value: unknown): ReportPage {
    const parsed: ParsedReportPage = ReportMetricPageSchema.parse(value);
    return Object.freeze({
      items: Object.freeze(
        parsed.items.map((item) =>
          Object.freeze({
            ...item,
            definition: Object.freeze({ ...item.definition, dimensions: Object.freeze([...item.definition.dimensions]) }),
            period: Object.freeze(item.period),
            dimensions: Object.freeze({ ...item.dimensions }),
            displayedDimensions: Object.freeze(item.displayedDimensions.map((dimension) => Object.freeze({ ...dimension }))),
          })
        )
      ),
      count: parsed.count,
      snapshot: Object.freeze({
        ...parsed.snapshot,
        query: Object.freeze({ ...parsed.snapshot.query }),
        watermark: Object.freeze({ ...parsed.snapshot.watermark }),
      }),
      ...(parsed.nextCursor === undefined ? {} : { nextCursor: parsed.nextCursor }),
    });
  }

  dimensions(value: unknown): ReportDimensions {
    return deepFreeze(ReportDimensionsSchema.parse(value));
  }

  export(value: unknown): ReportExport {
    return deepFreeze(ReportExportSchema.parse(value));
  }
}
