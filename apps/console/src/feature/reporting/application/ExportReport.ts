import { OP_REPORTING_EXPORTS_CREATE } from '@shop/contract/ids';
import { PERM_REPORTING_EXPORT_MANAGE } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportFilter, ReportSnapshot } from '../model/Report';
import type { ReportingPort } from '../public';

export class ExportReport {
  constructor(private readonly port: ReportingPort) {}
  execute(context: ConsoleContext, filter: ReportFilter, snapshot: ReportSnapshot, identity: string, signal?: AbortSignal) {
    if (!context.session.permissions.includes(PERM_REPORTING_EXPORT_MANAGE) || !context.session.capabilities.includes(OP_REPORTING_EXPORTS_CREATE)) throw new Error('当前账号没有导出报表的权限。');
    if (!context.session.csrf) throw new Error('安全会话已过期，请重新登录。');
    if (context.session.assurance.level < 3) throw new Error('STEPUP_REQUIRED');
    return this.port.createExport(context, filter, snapshot, identity, signal);
  }
}
