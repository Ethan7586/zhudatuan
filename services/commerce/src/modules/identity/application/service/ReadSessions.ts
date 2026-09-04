import { IdentityAction as OperationAction } from '../model/IdentityAction';
import { requireAccess } from '../../../../foundation/application/OperationAccess';

import { keysetRows, queryPage } from '../../../../foundation/application/Validation';
import type { SessionRepository } from '../port/SessionRepository';

export class ReadSessions {
  constructor(private readonly sessions: SessionRepository) {}
  action(): OperationAction<'read'> {
    return async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request.input);
      const result = await this.sessions.list(database, access.actor.id, access.actor.session, page);
      const rows = result.map((row) => Object.freeze({ ...row, createdAt: row.createdAt.toISOString(), lastSeenAt: row.lastSeenAt.toISOString(), expiresAt: row.expiresAt.toISOString() }));
      return keysetRows(rows, page, 'lastSeenAt');
    };
  }
}
