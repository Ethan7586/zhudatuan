import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { ChannelMapper } from '../infrastructure/ChannelMapper';
import { channelKey } from './ChannelQueryKey';

describe('ChannelViewModel boundaries', () => {
  it('isolates pages by scope, access version, view and cursor', () => {
    const context = { scope: { kind: 'enterprise', id: 'enterprise:one' }, session: { accessVersion: 4 } } as ConsoleContext;
    const first = channelKey(context, 'connections');
    const next = channelKey(context, 'connections', 'cursor:two');
    expect(first.slice(0, 4)).toEqual(['console', 'enterprise', 'enterprise:one', 4]);
    expect(first).not.toEqual(next);
  });

  it('rejects partial DTOs and retains the synchronization version', () => {
    const mapper = new ChannelMapper();
    expect(() => mapper.page('connections', { items: [{ id: 'connection:one' }], count: 1 })).toThrow();
    const page = mapper.page('syncs', { items: [{ id: 'sync:one', connection_id: 'connection:one', kind: 'catalog', state: 'queued', cursor_value: null, input_hash: 'hash', input: {}, error_summary: [], watermark: null, pulled_count: 0, accepted_count: 0, rejected_count: 0, started_at: null, completed_at: null, version: 8, cursor_sort: 'infinity' }], count: 1 });
    expect(page.items[0]).toMatchObject({ type: 'sync', version: 8 });
  });
});
