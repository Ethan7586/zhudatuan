import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('access governance role projection', () => {
  it('publishes the formal senior role as non-editable governance metadata', async () => {
    const source = await readFile(join(process.cwd(), 'src/modules/access/03_application_yingyong/AccessReadOperations.ts'), 'utf8');

    expect(source).toContain("role.id='role-senior-administrator-v1:'||role.scope_id");
    expect(source).toContain("then 'senior_administrator'");
    expect(source).toContain("role.id<>'role-senior-administrator-v1:'||role.scope_id");
    expect(source).toContain('coalesce(membership.operator_display_name,profile.display_name) display_name');
    expect(source).toContain("where membership.client='operator' and exists");
    expect(source).toContain('assignmentboundary.ancestor_id=coalesce(assignment.assigned_scope_id,role.scope_id)');
    expect(source).toContain('assignmentboundary.descendant_id=$1');
    expect(source).toContain('assignmentboundary.ancestor_id=$1');
    expect(source).toContain('assignmentboundary.descendant_id=coalesce(assignment.assigned_scope_id,role.scope_id)');
    expect(source).toContain('roleboundary.ancestor_id=role.scope_id and roleboundary.descendant_id=$1');
  });
});
