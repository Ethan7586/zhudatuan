import { describe, expect, it } from 'vitest';
import { Message } from './Message';

describe('Message', () => {
  it('accepts an immutable append-only message with a server sequence', () => {
    const message = new Message('message:one', 'client:0001', 'conversation:one', 'agent', 'actor:one', 'a'.repeat(64), 7, 1, '2026-09-02T00:00:00.000Z');
    expect(message.sequence).toBe(7);
    expect(Object.isFrozen(message)).toBe(true);
  });

  it.each([{ sequence: 0 }, { version: 0 }, { bodyHash: 'unsafe' }, { createdAt: 'today' }])('rejects invalid persisted evidence %o', (override) => {
    expect(() => new Message('message:one', 'client:0001', 'conversation:one', 'member', 'actor:one', override.bodyHash ?? 'a'.repeat(64), override.sequence ?? 1, override.version ?? 1, override.createdAt ?? '2026-09-02T00:00:00.000Z')).toThrow('SUPPORT_MESSAGE_INVALID');
  });
});
