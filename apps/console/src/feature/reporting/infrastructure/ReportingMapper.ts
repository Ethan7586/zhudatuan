import type { ReportExport, ReportPage } from '../model/Report';
import { ReportExportSchema, ReportPageSchema } from './ReportingSchema';

export class ReportingMapper {
  page(value: unknown): ReportPage {
    const parsed = ReportPageSchema.parse(value);
    return Object.freeze({
      items: Object.freeze(parsed.items.map((item) => Object.freeze({ ...item, period: Object.freeze(item.period), dimensions: Object.freeze({ ...item.dimensions }) }))),
      count: parsed.count,
      ...(parsed.nextCursor === undefined ? {} : { nextCursor: parsed.nextCursor }),
    });
  }

  export(value: unknown): ReportExport {
    const parsed = ReportExportSchema.parse(value);
    return Object.freeze({
      id: parsed.id,
      scope: parsed.scope,
      report: parsed.report,
      state: parsed.state,
      recordCount: parsed.recordCount,
      objectHash: parsed.objectHash,
      objectSize: parsed.objectSize,
      scanState: parsed.scanState,
      expiresAt: parsed.expiresAt,
      createdAt: parsed.createdAt,
      generatedAt: parsed.generatedAt,
      ...(parsed.download === undefined ? {} : { download: Object.freeze(parsed.download) }),
    });
  }
}
