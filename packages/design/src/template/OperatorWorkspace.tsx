import type { DisplayCollection } from '@shop/presentation';
import type { ActionInput, OperatorAction } from '@shop/presentation/actions';
import type { ReactNode } from 'react';
import { Brand } from '../atom/Brand';
import { PageHeader } from '../organism/PageHeader';
import { ResourceState, resourceCondition } from '../organism/ResourceState';
import { Worklist } from '../organism/Worklist';
import { OperatorActions, type OperatorActionResult } from '../organism/OperatorActions';
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
  readonly selectedKey?: string;
  readonly actions?: readonly OperatorAction[];
  readonly context?: ReactNode;
  readonly select?: (key: string) => void;
  readonly execute?: (action: OperatorAction, input: ActionInput) => Promise<OperatorActionResult>;
  readonly error?: string;
  readonly retry: () => void;
  readonly navigate: (path: string) => void;
}

export function OperatorWorkspace(props: Readonly<OperatorWorkspaceProps>) {
  const condition = resourceCondition(props.data, props.data?.rows.length ?? 0, props.error);
  return (
    <WorkspaceShell product={props.product} brand={<Brand variant="mark" product={props.product} inverse />} label={props.scopeLabel} path={props.pathname} items={props.items} navigate={props.navigate}>
      <main className="operatorpage">
        <PageHeader eyebrow={props.scopeLabel} title={props.title} description={props.description} {...(props.context === undefined ? {} : { context: props.context })} />
        {props.actions && props.execute ? <OperatorActions actions={props.actions} {...(props.selectedKey === undefined ? {} : { selectedKey: props.selectedKey })} execute={props.execute} /> : null}
        <ResourceState
          condition={condition}
          {...(props.error === undefined ? {} : { error: props.error })}
          retry={props.retry}
          emptyTitle="当前没有待处理记录"
          emptyMessage="数据已与服务端同步，可切换左侧任务查看其他业务。"
        >
          {props.data === undefined ? null : <Worklist value={props.data} {...(props.selectedKey === undefined ? {} : { selectedKey: props.selectedKey })} {...(props.select === undefined ? {} : { onSelect: props.select })} />}
        </ResourceState>
      </main>
    </WorkspaceShell>
  );
}
