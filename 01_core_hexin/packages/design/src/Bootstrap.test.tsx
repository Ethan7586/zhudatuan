import { describe, expect, it, vi } from 'vitest';
import { bootstrapApplication } from './Bootstrap';

describe('application bootstrap', () => {
  it('commits the application after its configuration-bearing module loads', async () => {
    const commit = vi.fn();
    await bootstrapApplication(() => Promise.resolve({ Providers: () => <p>ready</p> }), commit);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('commits a visible fail-closed state when module evaluation fails', async () => {
    const commit = vi.fn();
    await bootstrapApplication(() => Promise.reject(new Error('CLIENT_API_BASE_URL_MISSING')), commit);
    expect(commit).toHaveBeenCalledOnce();
    expect(JSON.stringify(commit.mock.calls[0]?.[0])).toContain('CLIENT_API_BASE_URL_MISSING');
  });
});
