import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class CopyApplication {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, application: string, targetMallId: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.copy);
    if (!targetMallId.trim()) throw new Error('EXPERIENCE_COPY_TARGET_REQUIRED');
    return this.port.copy(context, application, { targetMallId, reason: '控制台复制商城装修草稿' }, identity, signal);
  }
}
