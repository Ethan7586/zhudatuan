import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadCurrentFunctionSource, parseCurrentFunctionMarkdown } from './CurrentSource';

describe('current function source', () => {
  it('captures every LI business row including qualified provider statuses', async () => {
    const root = resolve(import.meta.dirname, '../../..');
    const { source } = await loadCurrentFunctionSource(root);

    expect(source.count).toBe(462);
    expect(source.statusCounts).toEqual({ 已开放: 177, 部分开放: 19, 后台具备: 167, 自动执行: 41, 仅设计: 29, 占位: 29 });
    expect(source.rows.filter(({ section }) => section === '11.2')).toHaveLength(11);
    expect(source.rows.at(-1)).toMatchObject({ id: 'LI0462', line: 660, section: '19' });
  });

  it('does not parse the status definition table as business functions', async () => {
    const source = await readFile(resolve(import.meta.dirname, '../../../../zhudatuan_li/docs/当前代码业务功能清单-20260904.md'), 'utf8');
    const rows = parseCurrentFunctionMarkdown(source);
    expect(rows[0]).toMatchObject({ id: 'LI0001', line: 22, section: '2.1' });
    expect(rows.every(({ line }) => line > 18)).toBe(true);
  });
});
