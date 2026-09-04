import { Button, Receipt, type ButtonTone, type ReceiptDetail } from '@shop/design';
import type { Receipt as ReceiptModel } from '@shop/presentation';
import type { ReactNode } from 'react';
import './ActionReceipt.css';

export interface ActionReceiptControl {
  readonly label: string;
  readonly onPress: () => void;
  readonly tone?: ButtonTone;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly busyLabel?: string;
}

interface ActionContext {
  readonly title: string;
  readonly message: string;
  readonly object: string;
  readonly impact: string;
  readonly details?: readonly ReceiptDetail[];
}

interface ConfirmState extends ActionContext {
  readonly kind: 'confirm';
  readonly confirm: ActionReceiptControl;
}

interface StepupState extends ActionContext {
  readonly kind: 'stepup';
  readonly verify: ActionReceiptControl;
}

type ApprovalState = ActionContext & (
  | Readonly<{ kind: 'approval'; status: 'required'; approval: ActionReceiptControl; reference?: string }>
  | Readonly<{ kind: 'approval'; status: 'pending' | 'approved' | 'rejected' | 'expired'; reference: string }>
);

interface ExecutingState extends Omit<ActionContext, 'object'> {
  readonly kind: 'executing';
  readonly requestId: string;
  readonly processed?: number;
  readonly total?: number;
}

interface SuccessState {
  readonly kind: 'success';
  readonly receipt: ReceiptModel;
  readonly objectLabel?: string;
  readonly impact: string;
  readonly details?: readonly ReceiptDetail[];
  readonly next?: ActionReceiptControl;
}

interface PartialState {
  readonly kind: 'partial';
  readonly receipt: ReceiptModel;
  readonly objectLabel?: string;
  readonly impact: string;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped?: number;
  readonly details?: readonly ReceiptDetail[];
  readonly retry: ActionReceiptControl;
  readonly next?: ActionReceiptControl;
}

interface RetryState {
  readonly kind: 'retry';
  readonly receipt: ReceiptModel;
  readonly objectLabel?: string;
  readonly impact: string;
  readonly retry: ActionReceiptControl;
}

export type ActionReceiptState = ConfirmState | StepupState | ApprovalState | ExecutingState | SuccessState | PartialState | RetryState;

export interface ActionReceiptProps {
  readonly state: ActionReceiptState;
  readonly dismiss?: ActionReceiptControl;
}

export function ActionReceipt({ state, dismiss }: Readonly<ActionReceiptProps>) {
  if (state.kind === 'success') {
    return <Outcome state={state} heading="操作已完成" tone="success" actions={[state.next, dismiss]} />;
  }
  if (state.kind === 'partial') {
    const details: readonly ReceiptDetail[] = [
      { label: '成功', value: `${state.succeeded} 项` },
      { label: '失败', value: `${state.failed} 项` },
      ...(state.skipped === undefined ? [] : [{ label: '跳过', value: `${state.skipped} 项` }]),
      ...(state.details ?? []),
    ];
    return <Outcome state={{ ...state, details }} heading="部分完成" tone="warning" actions={[state.retry, state.next, dismiss]} />;
  }
  if (state.kind === 'retry') {
    return <Outcome state={state} heading="执行未完成" tone="danger" actions={[state.retry, dismiss]} />;
  }
  const actions = stageActions(state, dismiss);
  const tone = stageTone(state);
  return (
    <section className="actionreceipt" data-kind={state.kind} data-tone={tone} role={state.kind === 'executing' ? 'status' : 'region'} aria-live={state.kind === 'executing' ? 'polite' : undefined} aria-busy={state.kind === 'executing' || undefined}>
      <header>
        <span className="actionreceiptmark" aria-hidden="true">{stageMark(state)}</span>
        <div><small>{stageLabel(state)}</small><h2>{state.title}</h2><p>{state.message}</p></div>
      </header>
      {'object' in state ? <dl className="actionreceiptcontext"><Context label="操作对象" value={state.object} /><Context label="影响范围" value={state.impact} />{state.details?.map((detail, index) => <Context key={`${detail.label}:${index}`} label={detail.label} value={detail.value} />)}</dl> : <Execution state={state} />}
      {state.kind === 'approval' ? <Approval state={state} /> : null}
      {actions.length === 0 ? null : <footer className="actionreceiptactions">{actions.map((action) => <ActionButton key={action.label} action={action} />)}</footer>}
    </section>
  );
}

type OutcomeState = SuccessState | PartialState | RetryState;

function Outcome({ state, heading, tone, actions }: Readonly<{ state: OutcomeState; heading: string; tone: 'success' | 'warning' | 'danger'; actions: readonly (ActionReceiptControl | undefined)[] }>) {
  return <div className="actionreceiptoutcome" data-kind={state.kind}>
    <Receipt receipt={state.receipt} impact={state.impact} heading={heading} tone={tone} {...(state.objectLabel === undefined ? {} : { objectLabel: state.objectLabel })} {...('details' in state && state.details !== undefined ? { details: state.details } : {})} {...('next' in state && state.next ? { next: state.next.label } : {})} />
    <footer className="actionreceiptactions">{actions.filter(isControl).map((action) => <ActionButton key={action.label} action={action} />)}</footer>
  </div>;
}

function Execution({ state }: Readonly<{ state: ExecutingState }>) {
  const total = state.total !== undefined && state.total > 0 ? state.total : undefined;
  const processed = total === undefined ? undefined : Math.max(0, Math.min(state.processed ?? 0, total));
  return <div className="actionreceiptexecution"><span>请求编号 <code>{state.requestId}</code></span>{total === undefined ? <progress aria-label="执行进度" /> : <><progress aria-label="执行进度" max={total} value={processed}>{processed}</progress><small>已处理 {processed} / {total}</small></>}</div>;
}

function Approval({ state }: Readonly<{ state: ApprovalState }>) {
  return <p className="actionreceiptapproval"><strong>{approvalLabel(state.status)}</strong>{state.reference === undefined ? null : <span>审批业务编号：{state.reference}</span>}</p>;
}

function Context({ label, value }: Readonly<{ label: string; value: ReactNode }>) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function ActionButton({ action }: Readonly<{ action: ActionReceiptControl }>) {
  return <Button tone={action.tone ?? 'default'} onPress={action.onPress} isDisabled={action.disabled === true || action.busy === true}>{action.busy ? action.busyLabel ?? '正在处理…' : action.label}</Button>;
}

function stageActions(state: ConfirmState | StepupState | ApprovalState | ExecutingState, dismiss: ActionReceiptControl | undefined): readonly ActionReceiptControl[] {
  if (state.kind === 'confirm') return [state.confirm, ...(dismiss ? [dismiss] : [])];
  if (state.kind === 'stepup') return [state.verify, ...(dismiss ? [dismiss] : [])];
  if (state.kind === 'approval' && state.status === 'required') return [state.approval, ...(dismiss ? [dismiss] : [])];
  return dismiss ? [dismiss] : [];
}

function stageTone(state: ConfirmState | StepupState | ApprovalState | ExecutingState): 'neutral' | 'warning' | 'success' | 'danger' {
  if (state.kind === 'confirm' || state.kind === 'executing') return 'neutral';
  if (state.kind === 'stepup' || (state.kind === 'approval' && (state.status === 'required' || state.status === 'pending'))) return 'warning';
  if (state.kind === 'approval' && state.status === 'approved') return 'success';
  return 'danger';
}

function stageMark(state: ConfirmState | StepupState | ApprovalState | ExecutingState): string {
  if (state.kind === 'confirm') return '✓';
  if (state.kind === 'stepup') return '◇';
  if (state.kind === 'approval') return state.status === 'approved' ? '✓' : state.status === 'rejected' || state.status === 'expired' ? '×' : '…';
  return '→';
}

function stageLabel(state: ConfirmState | StepupState | ApprovalState | ExecutingState): string {
  return ({ confirm: '确认操作', stepup: '身份复核', approval: '审批进度', executing: '正在执行' } as const)[state.kind];
}

function approvalLabel(status: ApprovalState['status']): string {
  return ({ required: '需要提交审批', pending: '审批处理中', approved: '审批已通过', rejected: '审批未通过', expired: '审批已过期' } as const)[status];
}

function isControl(value: ActionReceiptControl | undefined): value is ActionReceiptControl {
  return value !== undefined;
}
