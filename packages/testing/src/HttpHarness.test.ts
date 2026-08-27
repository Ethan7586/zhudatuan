import { describe, expect, it } from 'vitest';
import { contractErrorResponse, HttpHarness } from './HttpHarness';

const request = {
  url: 'https://smart.hbbtzn.com/api/health',
  method: 'GET',
  headers: { accept: 'application/json' },
} as const;

describe('HttpHarness', () => {
  it('captures immutable transport input', async () => {
    const harness = new HttpHarness(async () => ({ status: 200, headers: {}, body: '{}' }));
    await expect(harness.send(request)).resolves.toMatchObject({ status: 200 });
    expect(harness.requests).toHaveLength(1);
    expect(Object.isFrozen(harness.requests[0]?.headers)).toBe(true);
  });

  it('rejects requests that are already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = new HttpHarness(async () => ({ status: 200, headers: {}, body: '{}' }));
    await expect(harness.send({ ...request, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(harness.requests).toHaveLength(0);
  });

  it('builds a typed Error Contract transport response', () => {
    const response = contractErrorResponse(409, {
      code: 'VERSION_CONFLICT',
      message: '数据版本已变化',
      requestId: 'REQ-1',
    });
    expect(response.headers['x-request-id']).toBe('REQ-1');
    expect(JSON.parse(response.body)).toMatchObject({ code: 'VERSION_CONFLICT' });
  });
});
