import { describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { clearTaskImport, readTaskImport, taskImportPath } from './TaskLaunch';

describe('task import URL state', () => {
  it('encodes a typed import launch and optional pool once', () => {
    expect(taskImportPath(context, 'voucher', 'pool:one')).toBe('/scopes/mall/mall%3Aone/tasks?newimport=voucher&pool=pool%3Aone');
    expect(readTaskImport(new URLSearchParams('newimport=voucher&pool=pool%3Aone'))).toEqual({ kind: 'voucher', pool: 'pool:one' });
  });

  it('fails closed for unknown import owners and clears only launch fields', () => {
    expect(readTaskImport(new URLSearchParams('newimport=unknown&pool=&status=failed'))).toEqual({});
    expect(clearTaskImport(new URLSearchParams('newimport=order&pool=pool%3Aone&status=failed')).toString()).toBe('status=failed');
  });
});

const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context = { scope, session: { scope } } as ConsoleContext;
