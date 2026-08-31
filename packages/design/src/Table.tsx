import type { ReactNode } from 'react';

export interface TableColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  readonly caption: string;
  readonly columns: readonly TableColumn<T>[];
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
}

export function Table<T>({ caption, columns, rows, rowKey }: TableProps<T>) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
