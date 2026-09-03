import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { experienceOperations, type ApplicationUpdate } from '../model/Experience';
import type { ExperiencePort } from '../public';
export class UpdateApplication { constructor(private readonly port: ExperiencePort) {} execute(context: ConsoleContext, application: string, version: number, change: ApplicationUpdate, identity: string, signal?: AbortSignal) { assertOperationAccess(context, experienceOperations.update); if (!change.name.trim() || change.name.trim().length > 120) throw new Error('EXPERIENCE_NAME_INVALID'); return this.port.update(context, application, version, change, identity, signal); } }
