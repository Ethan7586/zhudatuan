// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable, type DataColumn } from './DataTable';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly state: string;
}

const columns: readonly DataColumn<Row>[] = Object.freeze([
  { key: 'name', label: '商品名称', render: (row) => row.name },
  { key: 'state', label: '状态', render: (row) => row.state },
]);

describe('DataTable', () => {
  it('exposes each column label to responsive cell layouts', () => {
    render(<DataTable caption="商品列表" columns={columns} rows={[{ id: 'one', name: '福利礼盒', state: '已上架' }]} rowKey={(row) => row.id} />);

    const row = screen.getByRole('row', { name: /福利礼盒/ });
    expect(row.querySelector('[data-column="name"]')?.getAttribute('data-label')).toBe('商品名称');
    expect(row.querySelector('[data-column="state"]')?.getAttribute('data-label')).toBe('状态');
  });
});
