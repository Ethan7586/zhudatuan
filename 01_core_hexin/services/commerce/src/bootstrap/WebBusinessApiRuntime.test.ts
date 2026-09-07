import { readFile } from 'node:fs/promises';
import { parseNodeManifest } from '@shop/config/server';
import { describe, expect, it } from 'vitest';
import type { DatabasePool } from '../foundation/persistence/Pool';
import {
  WEB_BUSINESS_SCHEMA_CHECKSUM,
  WEB_BUSINESS_SCHEMA_VERSION,
  assertWebBusinessApplicationBinding,
  assertWebBusinessNodeManifest,
  assertWebBusinessRuntimeCompatibility,
} from './WebBusinessApiRuntime';

describe('web business API runtime', () => {
  it('requires node-owned origins and an application bound to the same mall scope', async () => {
    const path = new URL('../../../../../02_platform_pingtai/config/node-manifests/hbbtzn-l1.json', import.meta.url);
    const manifest = parseNodeManifest(JSON.parse(await readFile(path, 'utf8')));
    expect(() => assertWebBusinessNodeManifest(manifest, ['https://hbbtzn.com', 'https://www.hbbtzn.com'], 'test')).not.toThrow();
    expect(() => assertWebBusinessNodeManifest(manifest, ['https://zhudatuan.com'], 'test'))
      .toThrow('WEB_BUSINESS_NODE_ORIGIN_MISMATCH');
    const bound = { query: async () => result([{ bound: true }], 1) } as unknown as DatabasePool;
    const wrong = { query: async () => result([{ bound: false }], 1) } as unknown as DatabasePool;
    await expect(assertWebBusinessApplicationBinding(bound, 'zdt-l1-verify', manifest.data_scope_ref)).resolves.toBeUndefined();
    await expect(assertWebBusinessApplicationBinding(wrong, 'zdt-l1-verify', 'mall-zhudatuan'))
      .rejects.toThrow('WEB_BUSINESS_APPLICATION_SCOPE_MISMATCH');
  });

  it('requires the dedicated role, schema marker, selected writes, and forbidden-write boundary', async () => {
    const healthy = {
      current_user: 'zhudatuanwebapi',
      session_user: 'zhudatuanwebapi',
      role_safe: true,
      writable: true,
      schema: true,
      contract: true,
      web_business: true,
      relations: true,
      functions: true,
      selected_writes: true,
      forbidden_writes: true,
    };
    const pool = (state: typeof healthy) => ({ query: async (sql: string, values: readonly unknown[]) => {
      expect(sql).toContain("not has_schema_privilege(current_user,'payment','USAGE')");
      expect(sql).toContain("not has_schema_privilege(current_user,'finance','USAGE')");
      expect(sql).toContain("to_regprocedure('access.web_storefront_scope(text,text)')");
      expect(sql).toContain("to_regprocedure('access.resolve_scope(text,text,text,text)')");
      expect(sql).toContain("to_regprocedure('access.web_risk_scope_allowed(text)')");
      expect(sql).toContain("to_regprocedure('benefit.web_account_balance(text,text)')");
      expect(sql).toContain("to_regprocedure('benefit.web_ledger(text,text)')");
      expect(sql).toContain("has_function_privilege(current_user,'benefit.web_ledger(text,text)','EXECUTE')");
      expect(sql).toContain("has_table_privilege(current_user,'access.decisionaudit','SELECT')");
      expect(values).toContain(WEB_BUSINESS_SCHEMA_VERSION);
      expect(values).toContain(WEB_BUSINESS_SCHEMA_CHECKSUM);
      return result([state], 1);
    } }) as unknown as DatabasePool;
    await expect(assertWebBusinessRuntimeCompatibility(pool(healthy))).resolves.toBeUndefined();
    await expect(assertWebBusinessRuntimeCompatibility(pool({ ...healthy, current_user: 'shopapp' })))
      .rejects.toThrow('WEB_BUSINESS_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertWebBusinessRuntimeCompatibility(pool({ ...healthy, session_user: 'shopmigration' })))
      .rejects.toThrow('WEB_BUSINESS_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertWebBusinessRuntimeCompatibility(pool({ ...healthy, role_safe: false })))
      .rejects.toThrow('WEB_BUSINESS_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertWebBusinessRuntimeCompatibility(pool({ ...healthy, web_business: false })))
      .rejects.toThrow('WEB_BUSINESS_RUNTIME_COMPATIBILITY_FAILED');
    await expect(assertWebBusinessRuntimeCompatibility(pool({ ...healthy, forbidden_writes: false })))
      .rejects.toThrow('WEB_BUSINESS_RUNTIME_COMPATIBILITY_FAILED');
  });
});

function result(rows: readonly unknown[], rowCount: number) {
  return { rows, rowCount, command: '', oid: 0, fields: [] };
}
