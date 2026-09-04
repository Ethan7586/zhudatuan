import type { DisplayCollection } from '@shop/presentation';
import { Brand } from './Brand';
import { PageHeader } from './PageHeader';
import { ResourceState, resourceCondition } from './ResourceState';
import { Worklist } from './Worklist';
import { WorkspaceShell } from './WorkspaceShell';

export interface OperatorNavigationItem {
  readonly id: string;
  readonly path: string;
  readonly title: string;
}

export interface OperatorWorkspaceProps {
  readonly product: string;
  readonly scopeLabel: string;
  readonly pathname: string;
  readonly title: string;
  readonly description: string;
  readonly items: readonly OperatorNavigationItem[];
  readonly data: DisplayCollection | undefined;
  readonly error?: string;
  readonly retry: () => void;
  readonly navigate: (path: string) => void;
}

export function OperatorWorkspace(props: Readonly<OperatorWorkspaceProps>) {
  const condition = resourceCondition(props.data, props.data?.rows.length ?? 0, props.error);
  return (
    <WorkspaceShell product={props.product} brand={<Brand variant="mark" product={props.product} inverse />} label={props.scopeLabel} path={props.pathname} items={props.items} navigate={props.navigate}>
      <main className="operatorpage">
        <PageHeader eyebrow={props.scopeLabel} title={props.title} description={props.description} />
        <ResourceState
          condition={condition}
          {...(props.error === undefined ? {} : { error: props.error })}
          retry={props.retry}
          emptyTitle="当前没有待处理记录"
          emptyMessage="数据已与服务端同步，可切换左侧任务查看其他业务。"
        >
          {props.data === undefined ? null : <Worklist value={props.data} />}
        </ResourceState>
      </main>
    </WorkspaceShell>
  );
}
