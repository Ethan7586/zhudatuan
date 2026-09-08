import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { generateCurrentFunctionTrace } from './CurrentTrace';

describe('current function trace', () => {
  it('gives every LI function one executable destination and evidence chain', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const { records } = await generateCurrentFunctionTrace(root);

    expect(records).toHaveLength(462);
    expect(new Set(records.map(({ id }) => id))).toHaveLength(462);
    expect(records.every(({ operations, routes, handlers, journeys, runbooks, evidence }) => operations.length > 0 && routes.length > 0 && handlers.length > 0 && journeys.length > 0 && runbooks.length > 0 && evidence.length > 0)).toBe(true);
    expect(records.every(({ deliveryStatus }) => deliveryStatus !== 'Designed')).toBe(true);
  });

  it('maps every formerly designed Rich Voucher line and visible placeholder to production code', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const { records } = await generateCurrentFunctionTrace(root);
    const designed = records.filter(({ source }) => source.status === '仅设计');
    const placeholders = records.filter(({ source }) => source.status === '占位');

    expect(designed).toHaveLength(29);
    expect(designed.every(({ disposition, modules }) => disposition === 'Implemented' && (modules.includes('voucher') || modules.includes('approval') || modules.includes('partner')))).toBe(true);
    expect(placeholders).toHaveLength(29);
    expect(placeholders.every(({ disposition, routes, primaryOperation }) => disposition === 'Replaced' && routes.length > 0 && primaryOperation.length > 0)).toBe(true);
  });

  it('binds all eleven qualified supplier rows to real extension manifests', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const { records } = await generateCurrentFunctionTrace(root);
    const providers = records.filter(({ source }) => source.section === '11.2');

    expect(providers).toHaveLength(11);
    expect(new Set(providers.flatMap(({ extensions }) => extensions))).toHaveLength(11);
    expect(providers.every(({ extensions }) => extensions.length === 1)).toBe(true);
  });
});
