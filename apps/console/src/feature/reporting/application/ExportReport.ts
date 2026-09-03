import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportFilter } from '../model/Report';
import type { ReportingPort } from '../public';

export class ExportReport {
  constructor(private readonly port: ReportingPort) {}
  execute(context: ConsoleContext, filter: ReportFilter, identity: string, signal?: AbortSignal) {
    if (!context.session.permissions.includes('reporting.export.manage') || !context.session.capabilities.includes('reporting.exports.create')) throw new Error('当前账号没有导出报表的权限。');
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    if (context.session.assurance.level < 3) throw new Error('STEPUP_REQUIRED');
    return this.port.createExport(context, filter, identity, signal);
  }
}
