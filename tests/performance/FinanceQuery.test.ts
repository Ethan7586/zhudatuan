import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parse } from 'yaml';

test('财务复杂筛选预算、范围查询与显式投影不可放宽', async () => {
  const telemetry = parse(await readFile('config/telemetry.yml', 'utf8'));
  assert.equal(telemetry.slo.facetP95Ms, 600);
  const files = ['services/commerce/src/modules/finance/infrastructure/persistence/FinanceScopeQuery.ts', 'services/commerce/src/modules/finance/infrastructure/persistence/JournalHashQuery.ts'];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\bselect\s+(?:[a-z][a-z0-9_]*\.)?\*/i);
    assert.doesNotMatch(source, /\boffset\s+(?:\$\d+|\d+)/i);
  }
});
