import { describe, expect, it } from 'vitest';
import { Installation } from './Installation';
import { HealthRecord } from './HealthRecord';

describe('Installation', () => {
  it('enforces the canary lifecycle without compatibility transitions', () => {
    const disabled = new Installation('connection:1', 'private', '1.0.0', 'mall:1', 'disabled', 0, 0);
    const testing = disabled.transition('testing');
    const enabled = testing.transition('enabled');
    expect([testing.state, testing.version, enabled.state, enabled.version]).toEqual(['testing', 1, 'enabled', 2]);
    expect(() => disabled.transition('enabled')).toThrow('EXTENSION_STATE_INVALID:disabled:enabled');
    expect(() => enabled.transition('testing')).toThrow('EXTENSION_STATE_INVALID:enabled:testing');
  });
  it('rejects malformed pinned versions and contradictory health metadata', () => {
    expect(() => new Installation('connection:1', 'private', 'latest', 'mall:1', 'disabled', 0, 0)).toThrow('EXTENSION_INSTALLATION_INVALID');
    expect(() => new HealthRecord('connection:1', 1, 'healthy', '2026-09-04T00:00:00.000Z', 1, 'unexpected')).toThrow('EXTENSION_HEALTH_INVALID');
    expect(() => new HealthRecord('connection:1', 1, 'degraded', 'invalid', 1, 'timeout')).toThrow('EXTENSION_HEALTH_INVALID');
  });
  it('increments configuration and aggregate versions with an explicit CAS', () => {
    const disabled = new Installation('connection:1', 'private', '1.0.0', 'mall:1', 'disabled', 3, 7);
    expect(disabled.reconfigure(3)).toMatchObject({ configurationVersion: 4, version: 8, state: 'disabled' });
    expect(() => disabled.reconfigure(2)).toThrow('EXTENSION_CONFIGURATION_VERSION_CONFLICT');
    expect(() => disabled.transition('testing').reconfigure(3)).toThrow('EXTENSION_RECONFIGURE_STATE_INVALID');
  });
});
