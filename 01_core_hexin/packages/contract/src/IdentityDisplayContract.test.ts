import { describe, expect, it } from 'vitest';
import { IdentityDisplayHintSchema } from './IdentityDisplayContract';

describe('IdentityDisplayHint contract', () => {
  it('accepts only the fixed OP and MB shapes', () => {
    expect(IdentityDisplayHintSchema.parse({ kind: 'operator', code: 'OP-7K2M', label: '管理身份' })).toEqual({
      kind: 'operator', code: 'OP-7K2M', label: '管理身份',
    });
    expect(IdentityDisplayHintSchema.parse({ kind: 'member', code: 'MB-4F9Q2A', label: '会员身份' })).toEqual({
      kind: 'member', code: 'MB-4F9Q2A', label: '会员身份',
    });
  });

  it.each(['OP-0K2M', 'OP-7K2MAA', 'MB-4F9Q', 'MB-4F9Q2O'])('rejects ambiguous or invalid code %s', (code) => {
    expect(() => IdentityDisplayHintSchema.parse({
      kind: code.startsWith('OP') ? 'operator' : 'member',
      code,
      label: code.startsWith('OP') ? '管理身份' : '会员身份',
    })).toThrow();
  });
});
