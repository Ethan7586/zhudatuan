import type { DimensionPreset, ReportExport, ReportPage } from '../model/Report';
import { deepFreeze } from '../../../shared/model/Immutable';
import { ReportExportSchema, ReportMetricPageSchema, ReportPageSchema } from './ReportingSchema';

type ParsedReportPage = Omit<ReportPage, 'nextCursor' | 'preset'> & Readonly<{
  nextCursor?: string | undefined;
  preset?: DimensionPreset | null | undefined;
}>;

export class ReportingMapper {
  page(value: unknown, sales = false): ReportPage {
    const parsed: ParsedReportPage = sales ? ReportPageSchema.parse(value) : ReportMetricPageSchema.parse(value);
    return Object.freeze({
      items: Object.freeze(parsed.items.map((item) => Object.freeze({
        ...item,
        definition: Object.freeze({ ...item.definition, dimensions: Object.freeze([...item.definition.dimensions]) }),
        period: Object.freeze(item.period),
        dimensions: Object.freeze({ ...item.dimensions }),
      }))),
      count: parsed.count,
      snapshot: Object.freeze({
        ...parsed.snapshot,
        query: Object.freeze({ ...parsed.snapshot.query }),
        watermark: Object.freeze({ ...parsed.snapshot.watermark }),
      }),
      ...(parsed.preset === undefined ? {} : { preset: parsed.preset === null ? null : Object.freeze({ ...parsed.preset, dimensions: Object.freeze([...parsed.preset.dimensions]) }) }),
      ...(parsed.nextCursor === undefined ? {} : { nextCursor: parsed.nextCursor }),
    });
  }

  export(value: unknown): ReportExport {
    return deepFreeze(ReportExportSchema.parse(value));
  }
}
