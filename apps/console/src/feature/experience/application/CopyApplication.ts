import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations, type ApplicationDraft } from '../model/Experience';
import { assertApplicationDraft } from '../model/ExperiencePolicy';
import type { ExperiencePort } from '../public';
export class CopyApplication { constructor(private readonly port: ExperiencePort) {} execute(context: ConsoleContext, application: string, draft: ApplicationDraft, identity: string, signal?: AbortSignal) { assertOperationAccess(context, experienceOperations.copy); assertApplicationDraft(draft); return this.port.copy(context, application, draft, '控制台复制商城应用', identity, signal); } }
