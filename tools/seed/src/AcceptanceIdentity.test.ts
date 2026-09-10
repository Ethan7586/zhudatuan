import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Client } from 'pg';

import { releaseRetiredAcceptanceSubject } from './AcceptanceIdentity';

const principal = 'member-registration-a2ac26ee-10ed-4591-9e9c-724590cddf50';
const subject = 'a'.repeat(64);

describe('acceptance identity reconciliation', () => {
  it('releases a retired registration fixture without deleting its evidence', async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
    const database = {
      async query(sql: string, values: readonly unknown[] = []) {
        calls.push({ sql, values });
        if (calls.length === 1) {
          return {
            rows: [
              {
                active_sessions: 0,
                credential_id: `credential:password:${principal}`,
                credential_status: 'revoked',
                membership_count: 2,
                memberships_safe: true,
                principal_id: principal,
                principal_status: 'disabled',
                profiles_safe: true,
              },
            ],
          };
        }
        return { rowCount: 1, rows: [] };
      },
    } as unknown as Client;

    await releaseRetiredAcceptanceSubject(database, 'password', subject, 'principal:acceptance');

    assert.equal(calls.length, 2);
    assert.match(calls[1]!.sql, /update identity\.credential/);
    assert.notEqual(calls[1]!.values[2], subject);
  });

  it('rejects a collision that belongs to any live identity', async () => {
    const database = {
      async query() {
        return {
          rows: [
            {
              active_sessions: 1,
              credential_id: `credential:password:${principal}`,
              credential_status: 'active',
              membership_count: 1,
              memberships_safe: false,
              principal_id: principal,
              principal_status: 'active',
              profiles_safe: false,
            },
          ],
        };
      },
    } as unknown as Client;

    await assert.rejects(releaseRetiredAcceptanceSubject(database, 'password', subject, 'principal:acceptance'), /ACCEPTANCE_SUBJECT_COLLISION:password/);
  });
});
