import { presentError } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { VoucherDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { createActionRequest } from '../../../shared/security/ActionRequest';
import type { VoucherAction } from '../model/VoucherAction';
import type { VoucherCommand } from '../model/VoucherCommand';

export function useVoucherActionViewModel(action: VoucherAction | null, context: ConsoleContext, dependencies: VoucherDependencies, onDone: (command: VoucherCommand) => void) {
  const [prefix, setPrefix] = useState('SW');
  const [scope, setScope] = useState(context.scope.id);
  const [count, setCount] = useState(1);
  const [version, setVersion] = useState(0);
  const [name, setName] = useState('员工福利券');
  const [amount, setAmount] = useState('100');
  const [days, setDays] = useState(365);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [status, setStatus] = useState<'draft' | 'active' | 'paused' | 'retired'>('draft');
  const [program, setProgram] = useState('');
  const [cardpool, setCardpool] = useState('');
  const [reserve, setReserve] = useState('');
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved');
  const [statusAction, setStatusAction] = useState<'activate' | 'disable' | 'extend' | 'void'>('activate');
  const [expiresAt, setExpiresAt] = useState('');
  const [member, setMember] = useState('');
  const [reason, setReason] = useState('');
  const [proof, setProof] = useState('');
  const [approval, setApproval] = useState('');
  const [approvalError, setApprovalError] = useState<string>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const actionKey = action === null ? 'closed' : `${action.kind}:${'record' in action ? action.record.id : ''}`;
  useEffect(() => {
    const record = action && 'record' in action ? action.record : undefined;
    setPrefix('SW'); setScope(context.scope.id); setCount(1); setVersion(record?.version ?? 0); setName(record?.name ?? '员工福利券');
    setAmount(record?.amountMinor === null || record?.amountMinor === undefined ? '100' : String(record.amountMinor / 100));
    setDays(record?.validityDays ?? 365); setApprovalRequired(record?.approvalRequired ?? true);
    setStatus(validStatus(record?.state)); setProgram(record?.programId ?? ''); setCardpool(record?.cardpoolId ?? '');
    setReserve(record?.reserveId ?? ''); setDecision('approved'); setStatusAction('activate'); setExpiresAt(''); setMember(record?.memberId ?? '');
    setReason(''); setProof(''); setApproval(''); setApprovalError(undefined);
    setIdentity(dependencies.createIdentity());
  }, [actionKey, context.scope.id, dependencies]);
  const mutation = useMutation<void, Error, VoucherCommand>({ mutationFn: (command) => execute(context, dependencies, command), onSuccess: (_, command) => onDone(command) });
  const build = (): VoucherCommand => {
    if (action === null) throw new Error('请选择一项卡券操作。');
    if (action.kind === 'createlibrary') return { kind: action.kind, prefix, identity };
    if (action.kind === 'allocatelibrary') return { kind: action.kind, library: action.record.id, version: action.record.version ?? 0, scope, count, proof, identity };
    if (action.kind === 'createprogram' || action.kind === 'editprogram') return { kind: 'saveprogram', draft: { ...(action.kind === 'editprogram' ? { id: action.record.id, version: action.record.version ?? 0 } : {}), name, valueMinor: minor(amount), validityDays: days, approvalRequired, status }, identity };
    if (action.kind === 'requestreserve') return { kind: action.kind, program, count, reason, identity };
    if (action.kind === 'decidereserve') return { kind: action.kind, reserve: action.record.id, version: action.record.version ?? 0, decision, reason, proof, identity };
    if (action.kind === 'issuebatch') return { kind: action.kind, program, version, cardpool, count, ...(reserve ? { reserve } : {}), proof, identity };
    if (action.kind === 'retrybatch') return { kind: action.kind, batch: action.record.id, version: action.record.version ?? 0, proof, identity };
    if (action.kind === 'statusbatch') return { kind: action.kind, ids: action.records.map((record) => record.voucherId ?? record.id), version: action.records[0]?.version ?? 0, action: statusAction, reason, ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}), proof, identity };
    if (action.kind === 'bind') return { kind: action.kind, voucher: action.record.voucherId ?? action.record.id, version: action.record.version ?? 0, member, reason, identity };
    return { kind: 'reverse', redemption: action.record.id, version: action.record.version ?? 0, reason, proof, identity };
  };
  const requestApproval = async () => {
    setApprovalError(undefined);
    try {
      const command = build();
      const envelope = approvalEnvelope(command);
      setApproval(await createActionRequest(envelope.operation, envelope.input, envelope.version, context.session.membership, context.scope.id));
    } catch (cause) { setApprovalError(presentError(cause).message); }
  };
  const resetProof = () => { setProof(''); setApproval(''); setIdentity(dependencies.createIdentity()); };
  const actions = useMemo(() => Object.freeze({
    prefix: (value: string) => { setPrefix(value); resetProof(); }, scope: (value: string) => { setScope(value); resetProof(); }, count: (value: number) => { setCount(value); resetProof(); }, version: (value: number) => { setVersion(value); resetProof(); },
    name: (value: string) => { setName(value); resetProof(); }, amount: (value: string) => { setAmount(value); resetProof(); }, days: (value: number) => { setDays(value); resetProof(); },
    approvalRequired: (value: boolean) => { setApprovalRequired(value); resetProof(); }, status: (value: typeof status) => { setStatus(value); resetProof(); },
    program: (value: string) => { setProgram(value); resetProof(); }, cardpool: (value: string) => { setCardpool(value); resetProof(); }, reserve: (value: string) => { setReserve(value); resetProof(); },
    decision: (value: typeof decision) => { setDecision(value); resetProof(); }, statusAction: (value: typeof statusAction) => { setStatusAction(value); resetProof(); }, expiresAt: (value: string) => { setExpiresAt(value); resetProof(); },
    member: (value: string) => { setMember(value); resetProof(); }, reason: (value: string) => { setReason(value); resetProof(); }, proof: setProof,
    requestApproval: () => void requestApproval(), submit: () => { if (!mutation.isPending) mutation.mutate(build()); }, reset: mutation.reset,
  }), [action, amount, approvalRequired, cardpool, count, days, decision, dependencies, expiresAt, identity, member, mutation, name, prefix, program, proof, reason, reserve, scope, status, statusAction, version]);
  return Object.freeze({ action, prefix, scope, count, version, name, amount, days, approvalRequired, status, program, cardpool, reserve, decision, statusAction, expiresAt, member, reason, proof, approval, assurance: context.session.assurance.level, busy: mutation.isPending, error: mutation.error ? presentError(mutation.error).message : approvalError, actions });
}

export type VoucherActionViewModel = ReturnType<typeof useVoucherActionViewModel>;

async function execute(context: ConsoleContext, dependencies: VoucherDependencies, command: VoucherCommand): Promise<void> {
  if (command.kind === 'createlibrary') return dependencies.createLibrary.execute(context, command.prefix, command.identity);
  if (command.kind === 'allocatelibrary') return dependencies.allocateLibrary.execute(context, command);
  if (command.kind === 'saveprogram') return dependencies.saveProgram.execute(context, command.draft, command.identity);
  if (command.kind === 'requestreserve') return dependencies.requestReserve.execute(context, command);
  if (command.kind === 'decidereserve') return dependencies.decideReserve.execute(context, command);
  if (command.kind === 'issuebatch') return dependencies.issueBatch.execute(context, command);
  if (command.kind === 'retrybatch') return dependencies.retryBatch.execute(context, command);
  if (command.kind === 'statusbatch') return dependencies.changeStatus.execute(context, command);
  if (command.kind === 'bind') return dependencies.bind.execute(context, command);
  return dependencies.reverse.execute(context, command);
}

function approvalEnvelope(command: VoucherCommand) {
  if (command.kind === 'allocatelibrary') return { operation: 'voucher.cardlibraries.allocate' as const, version: command.version, input: { path: { libraryid: command.library }, body: { scope: command.scope, count: command.count } } };
  if (command.kind === 'decidereserve') return { operation: 'voucher.reserves.decide' as const, version: command.version, input: { path: { reserveid: command.reserve }, body: { decision: command.decision, reason: command.reason } } };
  if (command.kind === 'issuebatch') return { operation: 'voucher.batches.issue' as const, version: command.version, input: { body: { program: command.program, cardpool: command.cardpool, count: command.count, ...(command.reserve ? { reserve: command.reserve } : {}) } } };
  if (command.kind === 'retrybatch') return { operation: 'voucher.batches.retry' as const, version: command.version, input: { path: { batchid: command.batch }, body: {} } };
  if (command.kind === 'statusbatch') return { operation: 'voucher.status.batch' as const, version: command.version, input: { body: { ids: command.ids, action: command.action, reason: command.reason, ...(command.expiresAt ? { expiresAt: command.expiresAt } : {}) } } };
  if (command.kind === 'reverse') return { operation: 'voucher.redemptions.reverse' as const, version: command.version, input: { path: { redemptionid: command.redemption }, body: { reason: command.reason } } };
  throw new Error('当前操作不需要双人复核。');
}

function minor(value: string): number {
  if (!/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('金额格式不正确。');
  return Math.round(Number(value) * 100);
}
function validStatus(value?: string): 'draft' | 'active' | 'paused' | 'retired' { return value === 'active' || value === 'paused' || value === 'retired' ? value : 'draft'; }
