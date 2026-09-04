import { describe, expect, it } from 'vitest';
import { presentResourceCondition, resourceCondition, resourceState } from './State';

describe('resource presentation state', () => {
  it('maps resource state to one shared UI condition and label', () => {
    expect(resourceCondition(resourceState({ pending: true, fetching: true, empty: false }))).toBe('loading');
    expect(resourceCondition(resourceState({ pending: false, fetching: true, data: [1], empty: false }))).toBe('refreshing');
    expect(presentResourceCondition('refreshing')).toBe('更新中');
    expect(presentResourceCondition('forbidden')).toBe('需处理');
  });
});
