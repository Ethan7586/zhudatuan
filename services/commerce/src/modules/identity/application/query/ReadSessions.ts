import type { OperationAction } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { keysetRows, queryPage } from '../../../../foundation/interface/Validation';
import type { SessionRepository } from '../port/SessionRepository';

export class ReadSessions {
  constructor(private readonly sessions: SessionRepository) {}
  action(): OperationAction {
    return async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request);
      const result = await this.sessions.list(database, access.actor.id, access.actor.session, page);
      const rows = result.map((row) => Object.freeze({ ...row, createdAt: row.createdAt.toISOString(), lastSeenAt: row.lastSeenAt.toISOString(), expiresAt: row.expiresAt.toISOString() }));
      return keysetRows(rows, page, 'lastSeenAt');
    };
  }
}
