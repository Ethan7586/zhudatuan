import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { orderExportFields } from '../../02_domain_yewu/model/ExportJob';
import { PgReportingRepository } from '../../04_adapters_shixian/persistence/PgReportingRepository';
import { createXlsxDocument, serializeCsvRow } from '../../05_interface_jieru/job/ExportJobRunner';

describe('order export documents', () => {
  it('creates a real XLSX workbook with the selected header and order values', async () => {
    const content = await createXlsxDocument(
      ['订单号', '消费会员', '订单金额（分）'],
      [['SW202609110001', 'member:ethan', 42569]],
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.getWorksheet('订单');

    expect(sheet?.getRow(1).values).toEqual([undefined, '订单号', '消费会员', '订单金额（分）']);
    expect(sheet?.getRow(2).values).toEqual([undefined, 'SW202609110001', 'member:ethan', 42569]);
    expect(sheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet?.autoFilter).toBeTruthy();
  });

  it('creates safe CSV rows with quoting and spreadsheet-formula neutralization', () => {
    expect(serializeCsvRow(['SW1', '家庭装,plus', '=2+2', 2])).toBe("SW1,\"家庭装,plus\",'=2+2,2");
  });

  it('keeps the requested order fields once and sends the full filter snapshot to the repository query', async () => {
    let statement = '';
    let parameters: readonly unknown[] | undefined;
    const database = {
      query: async (sql: string, values?: readonly unknown[]) => {
        statement = sql;
        parameters = values;
        return { rows: [{ key: 'order:1', values: ['SW1', 'member:1'] }], rowCount: 1 };
      },
    } as unknown as OperationDatabase;
    const repository = new PgReportingRepository(database);
    const filter = { fields: ['orderNumber', 'memberId', 'orderNumber'], orderIds: ['order:1'], view: 'active', payment: 'paid' };

    expect(orderExportFields(filter)).toEqual(['orderNumber', 'memberId']);
    await expect(repository.exportRows('export:1', 'orders', filter, null, 1000)).resolves.toEqual([
      { key: 'order:1', values: ['SW1', 'member:1'] },
    ]);
    expect(statement).toContain("job.filter?'orderIds'");
    expect(statement).toContain("authorization_snapshot->>'scopeKind'='owner'");
    expect(statement).toContain('closure.ancestor_id=job.scope_id');
    expect(statement).toContain("job.filter->>'view'='active'");
    expect(statement).toContain("orders.payment_state=job.filter->>'payment'");
    expect(parameters).toEqual(['export:1', null, 1000]);
  });

  it('loads the latest twenty order export tasks from the server scope', async () => {
    let statement = '';
    let parameters: readonly unknown[] | undefined;
    const row = {
      id: 'export:history', scope: 'mall:1', report: 'orders', filter: {}, state: 'completed', cursor: 'order:1', recordCount: 1,
      objectReference: 'reports/export/history.xlsx', objectHash: 'hash', objectSize: 128, scanState: 'clean', expiresAt: null,
      createdAt: '2026-09-11T09:00:00.000Z', generatedAt: '2026-09-11T09:00:01.000Z', errorCode: null,
    };
    const database = {
      query: async (sql: string, values?: readonly unknown[]) => {
        statement = sql;
        parameters = values;
        return { rows: [row], rowCount: 1 };
      },
    } as unknown as OperationDatabase;

    await expect(new PgReportingRepository(database).exports('mall:1', 'orders', 20)).resolves.toEqual([row]);
    expect(statement).toContain('order by job.created_at desc limit $3');
    expect(parameters).toEqual(['mall:1', 'orders', 20]);
  });
});
