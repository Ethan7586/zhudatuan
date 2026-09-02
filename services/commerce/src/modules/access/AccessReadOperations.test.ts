import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('access governance role projection', () => {
  it('publishes the formal senior role as non-editable governance metadata', async () => {
    const source = await readFile(join(process.cwd(), 'src/modules/access/AccessReadOperations.ts'), 'utf8');

    expect(source).toContain("role.id='role-senior-administrator-v1:'||role.scope_id");
    expect(source).toContain("then 'senior_administrator'");
    expect(source).toContain("role.id<>'role-senior-administrator-v1:'||role.scope_id");
  });
});
