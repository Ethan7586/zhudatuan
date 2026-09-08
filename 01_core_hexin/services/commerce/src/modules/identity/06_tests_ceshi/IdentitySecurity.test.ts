import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import { consumeChallenge } from '../05_interface_jieru/http/IdentitySecurity';

describe('identity challenge realm boundary', () => {
  it('does not mutate an L0 challenge when the request presents an L1 realm', async () => {
    const database = new PGlite();
    try {
      await database.exec(`create schema identity;
        create table identity.challenge(
          id text primary key,
          code_hash text not null,
          consumed_at timestamptz,
          expires_at timestamptz not null,
          attempts integer not null default 0,
          principal_id text,
          purpose text,
          destination_hash text,
          session_hash text,
          realm_id text,
          account_id text
        );
        insert into identity.challenge(id,code_hash,expires_at,purpose,destination_hash,realm_id,account_id)
        values('challenge:l0','correct-code',clock_timestamp()+interval '10 minutes','password_reset','mobile:l0','realm:l0','account:l0');`);

      await expect(consumeChallenge(database as unknown as OperationDatabase, 'challenge:l0', 'wrong-code',
        (_challenge, code) => code, undefined,
        { purpose: 'password_reset', destinationHash: 'mobile:l0', realmId: 'realm:l1', accountId: 'account:l0' }))
        .rejects.toMatchObject({ result: { status: 400, body: { code: 'CHALLENGE_INVALID' } } });
      expect((await database.query<{ attempts: number }>("select attempts from identity.challenge where id='challenge:l0'"))
        .rows[0]?.attempts).toBe(0);

      await expect(consumeChallenge(database as unknown as OperationDatabase, 'challenge:l0', 'wrong-code',
        (_challenge, code) => code, undefined,
        { purpose: 'password_reset', destinationHash: 'mobile:l0', realmId: 'realm:l0', accountId: 'account:l0' }))
        .rejects.toMatchObject({ result: { status: 400, body: { code: 'CHALLENGE_INVALID' } } });
      expect((await database.query<{ attempts: number }>("select attempts from identity.challenge where id='challenge:l0'"))
        .rows[0]?.attempts).toBe(1);
    } finally {
      await database.close();
    }
  });
});
