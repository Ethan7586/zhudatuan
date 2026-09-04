import { Button, ResourcePanel, type ResourceCondition } from '@shop/design';
import type { RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { DataTable, type DataColumn } from './DataTable';

export interface PagedResourceProps<T extends RowData> {
  readonly title: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly condition: ResourceCondition;
  readonly error?: string;
  readonly rows: readonly T[];
  readonly columns: readonly DataColumn<T>[];
  readonly rowKey: (row: T) => string;
  readonly count: number;
  readonly nextCursor?: string;
  readonly actions?: ReactNode;
  readonly boundary?: Readonly<{ title: string; message: string }>;
  readonly retry: () => void;
  readonly next: (cursor: string) => void;
}

export function PagedResource<T extends RowData>({ title, eyebrow, description, condition, error, rows, columns, rowKey, count,
  nextCursor, actions, boundary, retry, next }: PagedResourceProps<T>) {
  return (
    <ResourcePanel title={title} eyebrow={eyebrow} description={description} condition={condition}
      {...(error === undefined ? {} : { error })} retry={retry}
      actions={<>{actions}<Button onPress={retry}>刷新</Button></>}>
      <div className="featurestack">
        {boundary === undefined ? null : <section className="capabilitynote" aria-labelledby={`${safeId(title)}boundary`}>
          <h2 id={`${safeId(title)}boundary`}>{boundary.title}</h2><p>{boundary.message}</p>
        </section>}
        <DataTable caption={title} columns={columns} rows={rows} rowKey={rowKey} />
        <div className="pagination"><span>本页 {count} 条</span>
          <Button onPress={() => { if (nextCursor !== undefined) next(nextCursor); }} isDisabled={nextCursor === undefined}>下一页</Button>
        </div>
      </div>
    </ResourcePanel>
  );
}

function safeId(value: string): string {
  return [...value].map((character) => character.codePointAt(0)?.toString(16) ?? '').join('');
}
