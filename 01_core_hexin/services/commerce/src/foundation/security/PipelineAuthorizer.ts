import type { OperationAuthorizer } from '../interface/OperationController';
import type { AccessContext } from './AccessContext';
import type { AccessPipeline } from './AccessPipeline';

export class PipelineAuthorizer implements OperationAuthorizer {
  constructor(private readonly pipeline: AccessPipeline) {}

  authorize(headers: Readonly<Record<string, string>>, operation: string, permission: string, resource?: string): Promise<AccessContext> {
    return this.pipeline.authorize(headers, operation, permission, resource);
  }
}
