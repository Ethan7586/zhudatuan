import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import { CONSOLE_SUPPORT_SCHEMA_CHECKSUM, CONSOLE_SUPPORT_SCHEMA_VERSION, assertConsoleSupportRuntimeCompatibility } from './ConsoleSupportRuntime';

describe('console support runtime', () => {
  it('requires the direct support roles and the four-argument scope contract', async () => {
    const healthy = {
      current_user: 'shopconsole',
      session_user: 'zhudatuanconsoleapi',
      writable: true,
      schema: true,
      contract: true,
      support: true,
      relations: true,
      functions: true,
      selected_access: true,
    };
    const pool = (state: typeof healthy) =>
      ({
        query: async (sql: string, values: readonly unknown[]) => {
          expect(sql).toContain("to_regprocedure('access.resolve_scope(text,text,text,text)')");
          expect(sql).toContain("has_function_privilege(current_user,'access.resolve_scope(text,text,text,text)','EXECUTE')");
          expect(sql).toContain("to_regprocedure('access.resolve_governance(text,text,text,text)')");
          expect(sql).toContain("has_function_privilege(current_user,'access.resolve_governance(text,text,text,text)','EXECUTE')");
          expect(sql).toContain("to_regprocedure('access.resolve_authoritative_governance(text,text,text,text)')");
          expect(sql).toContain("has_function_privilege(current_user,'access.resolve_authoritative_governance(text,text,text,text)','EXECUTE')");
          expect(sql).toContain("has_table_privilege(current_user,'support.ticket','SELECT,INSERT,UPDATE')");
          expect(sql).toContain("has_table_privilege(current_user,'support.conversation','SELECT,INSERT,UPDATE')");
          expect(sql).toContain("has_table_privilege(current_user,'support.history','SELECT,INSERT')");
          expect(sql).toContain("has_table_privilege(current_user,'support.evidence','SELECT,INSERT')");
          expect(sql).toContain("has_table_privilege(current_user,'support.agent','SELECT')");
          expect(sql).toContain("has_table_privilege(current_user,'support.assignmentrule','SELECT')");
          expect(sql).toContain("has_table_privilege(current_user,'support.sla','SELECT')");
          expect(sql).toContain("has_table_privilege(current_user,'support.assignment','SELECT,INSERT,UPDATE')");
          expect(sql).toContain("has_table_privilege(current_user,'support.escalation','SELECT,INSERT')");
          expect(sql).toContain("has_table_privilege(current_user,'runtime.job','INSERT')");
          expect(values).toContain(CONSOLE_SUPPORT_SCHEMA_VERSION);
          expect(values).toContain(CONSOLE_SUPPORT_SCHEMA_CHECKSUM);
          return result([state]);
        },
      }) as unknown as DatabasePool;

    await expect(assertConsoleSupportRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertConsoleSupportRuntimeCompatibility(pool({ ...healthy, current_user: 'zhudatuanconsoleapi' }))).rejects.toThrow('CONSOLE_SUPPORT_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertConsoleSupportRuntimeCompatibility(pool({ ...healthy, functions: false }))).rejects.toThrow('CONSOLE_SUPPORT_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertConsoleSupportRuntimeCompatibility(pool({ ...healthy, support: false }))).rejects.toThrow('CONSOLE_SUPPORT_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly object[]) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}
