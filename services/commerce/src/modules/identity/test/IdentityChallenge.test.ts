import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import { OperationRejection } from '../../../pipeline/OperationRejection';
import { PgChallenge } from '../infrastructure/persistence/PgChallenge';
import { PgSessionRepository } from '../infrastructure/persistence/PgSessionRepository';
import { withReadTransaction, withWriteTransaction } from '../../../test/TransactionFixture';

const digest = (challenge: string, code: string) => `digest:${challenge}:${code}`;

describe('identity login challenge', () => {
  it('locks a valid OTP without consuming it, then consumes it exactly once', async () => {
    let consumed = false;
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const query = async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      if (text.startsWith('select principal_id from identity.challenge')) {
        return result(consumed ? [] : [{ principal_id: 'principal:one' }]);
      }
      if (text.startsWith('update identity.challenge set consumed_at')) {
        if (consumed) return result([]);
        consumed = true;
        return result([{ principal_id: 'principal:one' }]);
      }
      return result([]);
    };

    const challenges = new PgChallenge();
    await expect(
      withWriteTransaction(query, (context) =>
        challenges.verify(context, 'challenge:login', '123456', digest, {
          purpose: 'login',
          destinationHash: 'subject:digest',
        })
      )
    ).resolves.toEqual({ principal_id: 'principal:one' });
    expect(queries[0]?.text).toContain('for update');
    expect(queries[0]?.text).not.toContain('set attempts');
    expect(queries[0]?.values).toEqual(['challenge:login', 'digest:challenge:login:123456', 'login', 'subject:digest', 10]);

    await expect(
      withWriteTransaction(query, (context) =>
        challenges.consume(context, 'challenge:login', '123456', digest, 'principal:one', {
          purpose: 'login',
          destinationHash: 'subject:digest',
        })
      )
    ).resolves.toEqual({ principal_id: 'principal:one' });
    await expect(
      withWriteTransaction(query, (context) =>
        challenges.consume(context, 'challenge:login', '123456', digest, 'principal:one', {
          purpose: 'login',
          destinationHash: 'subject:digest',
        })
      )
    ).rejects.toBeInstanceOf(OperationRejection);
    expect(queries.filter(({ text }) => text.startsWith('update identity.challenge set consumed_at'))).toHaveLength(2);
  });

  it('increments the attempt counter and fails closed for a mismatched purpose or destination', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const query = async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      return result([]);
    };

    await expect(
      withWriteTransaction(query, (context) =>
        new PgChallenge().verify(context, 'challenge:login', '000000', digest, {
          purpose: 'login',
          destinationHash: 'other:subject',
        })
      )
    ).rejects.toMatchObject({ result: { status: 400, body: { code: 'CHALLENGE_INVALID' } } });
    expect(queries).toHaveLength(2);
    expect(queries[1]?.text).toContain('attempts=least($2,attempts+1)');
    expect(queries[1]?.values).toEqual(['challenge:login', 10]);
  });

  it('advances the principal session version and only carries it to surviving sessions', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const query = async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      return text.includes('returning credential_version') ? result([{ credential_version: 8 }]) : result([]);
    };

    await expect(withWriteTransaction(query, (context) => new PgSessionRepository().advance(context, 'principal:one'))).resolves.toBe(8);
    expect(queries).toHaveLength(2);
    expect(queries[0]?.text).toContain('credential_version=credential_version+1');
    expect(queries[1]?.text).toContain('where principal_id=$1 and revoked_at is null');
    expect(queries[1]?.values).toEqual(['principal:one', 8]);
  });

  it('lowers only the current live session to its strongest non-stepup assurance', async () => {
    const queries: Array<Readonly<{ text: string; values: readonly unknown[] }>> = [];
    const query = async (text: string, values: readonly unknown[] = []) => {
      queries.push({ text, values });
      return result([{ assurance_level: 2 }]);
    };

    await expect(withWriteTransaction(query, (context) => new PgSessionRepository().lower(context, 'principal:one', 'session:one'))).resolves.toBe(2);
    expect(queries).toHaveLength(1);
    expect(queries[0]?.text).toContain("source.method<>'otp'");
    expect(queries[0]?.text).toContain('least(2');
    expect(queries[0]?.text).toContain('target.revoked_at is null');
    expect(queries[0]?.values).toEqual(['session:one', 'principal:one']);
  });
});

function result(rows: readonly Record<string, unknown>[]): QueryResult {
  return { rows, rowCount: rows.length } as unknown as QueryResult;
}
