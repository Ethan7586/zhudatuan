import type { OperationActions, OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { operationLifecycle, requireAccess } from '../../../../foundation/application/ModuleOperations';
import type { ObjectStore } from '../../../../foundation/infrastructure/ObjectStore';
import type { ReportingFactory } from '../port/ReportingPort';

export function getExportOperations(factory: ReportingFactory<OperationDatabase>, objects: ObjectStore): OperationActions {
  return { 'reporting.exports.read': operationLifecycle({
    async execute(request, database) {
      const access = requireAccess(request);
      const job = await factory(database).export(request.input.path.exportid!, access.scope.id);
      if (!job) throw new Error('RESOURCE_NOT_FOUND');
      return { status: 200, body: job };
    },
    async finalize(_request, result) {
      const job = result.body as Readonly<{ state: string; objectReference: string | null; scanState: string | null }>;
      if (job.state !== 'completed') return result;
      if (!job.objectReference || job.scanState !== 'clean') throw new Error('REPORT_EXPORT_OBJECT_INVALID');
      const download = await objects.authorize(job.objectReference, 300);
      return { ...result, body: { ...job, download } };
    },
  }) };
}
