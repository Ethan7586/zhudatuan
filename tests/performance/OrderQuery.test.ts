import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';
import './MallEntry.spec';

test('订单列表和详情预算及 SQL 分页规则不可放宽', async () => {
  const telemetry = parse(await readFile('config/telemetry.yml', 'utf8'));
  assert.equal(telemetry.slo.queryP95Ms, 300);
  assert.equal(telemetry.slo.detailP95Ms, 500);
  const files = ['services/commerce/src/modules/order/infrastructure/persistence/PgOrderRepository.ts', 'services/commerce/src/modules/order/infrastructure/persistence/PgOrderDetailRepository.ts'];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\bselect\s+(?:[a-z][a-z0-9_]*\.)?\*/i);
    assert.doesNotMatch(source, /\boffset\s+(?:\$\d+|\d+)/i);
    if (file.endsWith('PgOrderRepository.ts')) assert.match(source, /limit\s+\$/i);
  }
});
