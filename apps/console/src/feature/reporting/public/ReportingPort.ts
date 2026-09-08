import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportDimensions, ReportExport, ReportFilter, ReportPage, ReportSnapshot } from '../model/Report';

export interface ReportingPort {
  readDimensions(context: ConsoleContext, signal?: AbortSignal): Promise<ReportDimensions>;
  read(context: ConsoleContext, filter: ReportFilter, signal?: AbortSignal): Promise<ReportPage>;
  createExport(context: ConsoleContext, filter: ReportFilter, snapshot: ReportSnapshot, identity: string, signal?: AbortSignal): Promise<ReportExport>;
  readExport(context: ConsoleContext, id: string, signal?: AbortSignal): Promise<ReportExport>;
}
