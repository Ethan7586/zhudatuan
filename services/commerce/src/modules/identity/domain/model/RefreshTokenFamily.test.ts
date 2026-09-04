import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RefreshTokenFamily } from './RefreshTokenFamily';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');

describe('RefreshTokenFamily', () => {
  it('rotates once into the next sequence without accepting a prior family token', () => {
    const issued = new RefreshTokenFamily({
      id: 'tokenfamily:one',
      session: 'session:one',
      current: { id: 'refreshtoken:one', hash: digest('first'), sequence: 0, issuedAt: new Date('2026-09-04T00:00:00.000Z') },
    });
    const rotated = issued.rotate(digest('first'), { id: 'refreshtoken:two', hash: digest('second') }, new Date('2026-09-04T00:01:00.000Z'));
    expect(rotated).toMatchObject({ id: issued.id, session: issued.session, current: { id: 'refreshtoken:two', sequence: 1 } });
    expect(() => rotated.rotate(digest('first'), { id: 'refreshtoken:three', hash: digest('third') }, new Date('2026-09-04T00:02:00.000Z'))).toThrow('AUTH_TICKET_EXCHANGE_REJECTED');
  });
});
