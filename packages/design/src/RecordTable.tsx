import { tableFeatures, useTable, type ColumnDef } from '@tanstack/react-table';
import { useMemo, type ReactNode } from 'react';

const features = tableFeatures({});

export interface RecordColumn<T extends Readonly<Record<string, unknown>>> {
  readonly key: string;
  readonly label: string;
  readonly value: (row: T) => ReactNode;
}

export interface RecordTableProps<T extends Readonly<Record<string, unknown>>> {
  readonly caption: string;
  readonly rows: readonly T[];
  readonly columns: readonly RecordColumn<T>[];
  readonly rowKey: (row: T, index: number) => string;
}

export function RecordTable<T extends Readonly<Record<string, unknown>>>({ caption, rows, columns, rowKey }: RecordTableProps<T>) {
  const data = useMemo(() => [...rows], [rows]);
  const definitions: ColumnDef<typeof features, T>[] = useMemo(() => columns.map((column) => ({
    id: column.key,
    header: column.label,
    cell: (info) => column.value(info.row.original),
  })), [columns]);
  const table = useTable({ features, data, columns: definitions, getRowId: (row, index) => rowKey(row, index) });
  return (
    <table>
      <caption>{caption}</caption>
      <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id} scope="col">{header.isPlaceholder ? null : <table.FlexRender header={header} />}</th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getAllCells().map((cell) => <td key={cell.id}><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody>
    </table>
  );
}

export function display(value: unknown): ReactNode {
  if (value === undefined || value === null || value === '') return <span className="muted">—</span>;
  if (Array.isArray(value)) return value.map(displayItem).join('、');
  if (typeof value === 'object') return <span className="muted">结构化信息</span>;
  return displayItem(value);
}

function displayItem(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return '结构化信息';
}

export function money(value: unknown): ReactNode {
  return typeof value === 'number'
    ? new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value / 100)
    : display(value);
}
