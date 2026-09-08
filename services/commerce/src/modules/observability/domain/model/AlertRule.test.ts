import { describe, expect, it } from 'vitest';
import { AlertRule } from './AlertRule';

describe('AlertRule', () => {
  it('fires only above its configured boundary and retains owner and runbook', () => {
    const rule = new AlertRule({
      id: 'failure',
      title: '失败',
      signal: 'commerce.operation.failure',
      measure: 'percent',
      threshold: 1,
      windowSeconds: 300,
      severity: 'critical',
      owner: 'reliability',
      runbook: 'docs/operations/deployment.md',
    });
    expect(rule.active(1)).toBe(false);
    expect(rule.active(1.01)).toBe(true);
    expect(rule.definition).toMatchObject({ owner: 'reliability', severity: 'critical', runbook: 'docs/operations/deployment.md' });
  });

  it('rejects an unactionable rule', () => {
    expect(() => new AlertRule({ id: 'failure', title: '失败', signal: 'commerce.operation.failure', measure: 'count', threshold: 0, windowSeconds: 10, severity: 'warning', owner: 'reliability', runbook: '' })).toThrow(
      'ALERT_RULE_INVALID:failure'
    );
  });
});
