import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportingPort } from '../public';

export class ReadExport {
  constructor(private readonly port: ReportingPort) {}
  execute(context: ConsoleContext, id: string, signal?: AbortSignal) {
    if (!context.session.permissions.includes('reporting.export.read') || !context.session.capabilities.includes('reporting.exports.read')) throw new Error('当前账号没有读取导出结果的权限。');
    return this.port.readExport(context, id, signal);
  }
}
