import { createColumnHelper, tableFeatures, useTable, type RowData } from '@tanstack/react-table';
import { useMemo, type ReactNode } from 'react';

const features = tableFeatures({});

export interface DataColumn<T extends RowData> {
  readonly key: string;
  readonly label: string;
  readonly render: (row: T) => ReactNode;
}

export interface DataTableProps<T extends RowData> {
  readonly caption: string;
  readonly columns: readonly DataColumn<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
}

export function DataTable<T extends RowData>({ caption, columns, rows, rowKey }: DataTableProps<T>) {
  const labels = useMemo(() => new Map(columns.map((column) => [column.key, column.label])), [columns]);
  const tableColumns = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return helper.columns(columns.map((column) => helper.accessor((row) => row, { id: column.key, header: column.label, cell: ({ row }) => column.render(row.original) })));
  }, [columns]);
  const data = useMemo(() => [...rows], [rows]);
  const table = useTable({ features, data, columns: tableColumns, getRowId: (row) => rowKey(row) });
  return (
    <div className="tablewrap" role="region" aria-label={caption} tabIndex={0}>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} scope="col" data-column={header.column.id}>
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id} data-column={cell.column.id} data-label={labels.get(cell.column.id)}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
