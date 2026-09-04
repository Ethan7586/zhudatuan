import { OP_REPORTING_EXPORTS_READ } from '@shop/contract/ids';
import { PERM_REPORTING_EXPORT_READ } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { ReportingPort } from '../public';

export class ReadExport {
  constructor(private readonly port: ReportingPort) {}
  execute(context: ConsoleContext, id: string, signal?: AbortSignal) {
    if (!context.session.permissions.includes(PERM_REPORTING_EXPORT_READ) || !context.session.capabilities.includes(OP_REPORTING_EXPORTS_READ)) throw new Error('当前账号没有读取导出结果的权限。');
    return this.port.readExport(context, id, signal);
  }
}
