import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportExport, ReportFilter, ReportPage, ReportSnapshot } from '../model/Report';

export interface ReportingPort {
  read(context: ConsoleContext, filter: ReportFilter, signal?: AbortSignal): Promise<ReportPage>;
  createExport(context: ConsoleContext, filter: ReportFilter, snapshot: ReportSnapshot, identity: string, signal?: AbortSignal): Promise<ReportExport>;
  readExport(context: ConsoleContext, id: string, signal?: AbortSignal): Promise<ReportExport>;
}
