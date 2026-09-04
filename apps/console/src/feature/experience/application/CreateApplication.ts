import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations, type ApplicationDraft } from '../model/Experience';
import { assertApplicationDraft } from '../model/ExperiencePolicy';
import type { ExperiencePort } from '../public';
export class CreateApplication {
  constructor(private readonly port: ExperiencePort) {}
  execute(context: ConsoleContext, draft: ApplicationDraft, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, experienceOperations.create);
    assertApplicationDraft(draft);
    return this.port.create(context, draft, identity, signal);
  }
}
