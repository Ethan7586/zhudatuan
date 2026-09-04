import { RunExport } from '../../application/process/RunExport';
import type { ExportPlan, ExportRenderer, ExportRunnerPort } from '../../public/ExportProcess';
import type { ClaimedJob } from '../../public/JobProcess';
import type { ObjectStore } from '../../public/ObjectPort';

export class RuntimeExportExecution implements ExportRunnerPort {
  constructor(private readonly objects: ObjectStore) {}

  executeExport<TPlan extends ExportPlan>(kind: string, id: string, job: ClaimedJob, signal: AbortSignal, deadline: number, renderer: ExportRenderer<TPlan>): Promise<void> {
    return new RunExport(kind, this.objects).execute(id, job, signal, deadline, renderer);
  }
}
