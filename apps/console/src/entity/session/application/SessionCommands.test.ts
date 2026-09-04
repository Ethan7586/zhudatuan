import { describe, expect, it, vi } from 'vitest';
import { CompleteStepup } from './CompleteStepup';
import { DisableStepup } from './DisableStepup';
import { StartStepup } from './StartStepup';
import type { SessionPort } from '../public/SessionPort';

const context = Object.freeze({ accessVersion: 7, csrf: 'csrf-token', idempotencyKey: 'command:one' });

describe('session commands', () => {
  it('rejects a challenge that is not bound to the requested review action', async () => {
    const port = sessionPort({ startStepup: vi.fn().mockResolvedValue({ id: 'challenge:1', actionBound: false }) });
    const command = new StartStepup(port);
    await expect(
      command.execute(context, {
        operation: 'access.roles.manage',
        resource: 'role:1',
        requestHash: 'a'.repeat(64),
        expectedVersion: 1,
        makerMembership: 'membership:1',
      })
    ).rejects.toThrow('ACTION_REQUEST_BINDING_INVALID');
  });

  it('rejects a completion that does not reach elevated assurance', async () => {
    const port = sessionPort({ completeStepup: vi.fn().mockResolvedValue({ assurance: 2 }) });
    await expect(new CompleteStepup(port).execute(context, 'challenge:1', '123456')).rejects.toThrow('STEPUP_ASSURANCE_INVALID');
  });

  it('accepts only a disabled elevated session', async () => {
    const valid = sessionPort({ disableStepup: vi.fn().mockResolvedValue({ assurance: 2 }) });
    await expect(new DisableStepup(valid).execute(context)).resolves.toBeUndefined();
    const invalid = sessionPort({ disableStepup: vi.fn().mockResolvedValue({ assurance: 3 }) });
    await expect(new DisableStepup(invalid).execute(context)).rejects.toThrow('STEPUP_DISABLE_INVALID');
  });
});

function sessionPort(overrides: Partial<SessionPort>): SessionPort {
  return {
    read: vi.fn(),
    profile: vi.fn(),
    layers: vi.fn(),
    delete: vi.fn(),
    disableStepup: vi.fn(),
    startStepup: vi.fn(),
    completeStepup: vi.fn(),
    ...overrides,
  };
}
