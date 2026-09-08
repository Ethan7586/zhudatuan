import { describe, expect, it } from 'vitest';
import { moduleDatabaseRoles } from './DatabaseRoles';

describe('moduleDatabaseRoles', () => {
  it('derives one owner, reader and writer role from each schema authority', () => {
    const objects = Array.from({ length: 33 }, (_, index) => {
      const suffix = String.fromCharCode(97 + Math.floor(index / 26)) + String.fromCharCode(97 + (index % 26));
      return `  - id: ${suffix}\n    kind: schema\n    owner: shop${suffix}owner`;
    }).join('\n');
    const roles = moduleDatabaseRoles(`version: 1\nobjects:\n${objects}\n`);
    expect(roles).toHaveLength(99);
    expect(roles.slice(0, 3)).toEqual(['shopaaowner', 'shopaareader', 'shopaawriter']);
    expect(new Set(roles).size).toBe(99);
  });

  it('fails closed when the generated authority contract is incomplete', () => {
    expect(() => moduleDatabaseRoles('version: 1\nobjects: []\n')).toThrow('MODULE_DATABASE_ROLE_COUNT_INVALID:0');
  });
});
