import { presentError } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { VoucherDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { createActionRequest } from '../../../shared/security/ActionRequest';
import type { VoucherAction } from '../model/VoucherAction';
import type { VoucherCommand } from '../model/VoucherCommand';
import { approvalEnvelope, execute, minor, validStatus } from './VoucherActionCommand';

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
  useEffect(() => {
    const record = action && 'record' in action ? action.record : undefined;
    setPrefix('SW');
    setScope(context.scope.id);
    setCount(1);
    setVersion(record?.version ?? 0);
    setName(record?.name ?? '员工福利券');
    setAmount(record?.amountMinor === null || record?.amountMinor === undefined ? '100' : String(record.amountMinor / 100));
    setDays(record?.validityDays ?? 365);
    setApprovalRequired(record?.approvalRequired ?? true);
    setStatus(validStatus(record?.state));
    setProgram(record?.programId ?? '');
    setCardpool(record?.cardpoolId ?? '');
    setReserve(record?.reserveId ?? '');
    setDecision('approved');
    setStatusAction('activate');
    setExpiresAt('');
    setMember(record?.memberId ?? '');
    setReason('');
    setProof('');
    setApproval('');
    setApprovalError(undefined);
    setIdentity(dependencies.createIdentity());
  }, [action, context.scope.id, dependencies]);
  const mutation = useMutation<void, Error, VoucherCommand>({ mutationFn: (command) => execute(context, dependencies, command), onSuccess: (_, command) => onDone(command) });
  const build = useCallback((): VoucherCommand => {
    if (action === null) throw new Error('请选择一项卡券操作。');
    if (action.kind === 'createlibrary') return { kind: action.kind, prefix, identity };
    if (action.kind === 'allocatelibrary') return { kind: action.kind, library: action.record.id, version: action.record.version ?? 0, scope, count, proof, identity };
    if (action.kind === 'createprogram' || action.kind === 'editprogram')
      return {
        kind: 'saveprogram',
        draft: { ...(action.kind === 'editprogram' ? { id: action.record.id, version: action.record.version ?? 0 } : {}), name, valueMinor: minor(amount), validityDays: days, approvalRequired, status },
        identity,
      };
    if (action.kind === 'requestreserve') return { kind: action.kind, program, count, reason, identity };
    if (action.kind === 'decidereserve') return { kind: action.kind, reserve: action.record.id, version: action.record.version ?? 0, decision, reason, proof, identity };
    if (action.kind === 'issuebatch') return { kind: action.kind, program, version, cardpool, count, ...(reserve ? { reserve } : {}), proof, identity };
    if (action.kind === 'retrybatch') return { kind: action.kind, batch: action.record.id, version: action.record.version ?? 0, proof, identity };
    if (action.kind === 'statusbatch')
      return {
        kind: action.kind,
        ids: action.records.map((record) => record.voucherId ?? record.id),
        version: action.records[0]?.version ?? 0,
        action: statusAction,
        reason,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        proof,
        identity,
      };
    if (action.kind === 'bind') return { kind: action.kind, voucher: action.record.voucherId ?? action.record.id, version: action.record.version ?? 0, member, reason, identity };
    return { kind: 'reverse', redemption: action.record.id, version: action.record.version ?? 0, reason, proof, identity };
  }, [action, amount, approvalRequired, cardpool, count, days, decision, expiresAt, identity, member, name, prefix, program, proof, reason, reserve, scope, status, statusAction, version]);
  const requestApproval = useCallback(async () => {
    setApprovalError(undefined);
    try {
      const command = build();
      const envelope = approvalEnvelope(command);
      setApproval(await createActionRequest(envelope.operation, envelope.input, envelope.version, context.session.membership, context.scope.id));
    } catch (cause) {
      setApprovalError(presentError(cause).message);
    }
  }, [build, context.scope.id, context.session.membership]);
  const resetProof = useCallback(() => {
    setProof('');
    setApproval('');
    setIdentity(dependencies.createIdentity());
  }, [dependencies]);
  const actions = useMemo(
    () =>
      Object.freeze({
        prefix: (value: string) => {
          setPrefix(value);
          resetProof();
        },
        scope: (value: string) => {
          setScope(value);
          resetProof();
        },
        count: (value: number) => {
          setCount(value);
          resetProof();
        },
        version: (value: number) => {
          setVersion(value);
          resetProof();
        },
        name: (value: string) => {
          setName(value);
          resetProof();
        },
        amount: (value: string) => {
          setAmount(value);
          resetProof();
        },
        days: (value: number) => {
          setDays(value);
          resetProof();
        },
        approvalRequired: (value: boolean) => {
          setApprovalRequired(value);
          resetProof();
        },
        status: (value: typeof status) => {
          setStatus(value);
          resetProof();
        },
        program: (value: string) => {
          setProgram(value);
          resetProof();
        },
        cardpool: (value: string) => {
          setCardpool(value);
          resetProof();
        },
        reserve: (value: string) => {
          setReserve(value);
          resetProof();
        },
        decision: (value: typeof decision) => {
          setDecision(value);
          resetProof();
        },
        statusAction: (value: typeof statusAction) => {
          setStatusAction(value);
          resetProof();
        },
        expiresAt: (value: string) => {
          setExpiresAt(value);
          resetProof();
        },
        member: (value: string) => {
          setMember(value);
          resetProof();
        },
        reason: (value: string) => {
          setReason(value);
          resetProof();
        },
        proof: setProof,
        requestApproval: () => void requestApproval(),
        submit: () => {
          if (!mutation.isPending) mutation.mutate(build());
        },
        reset: mutation.reset,
      }),
    [build, mutation, requestApproval, resetProof]
  );
  return Object.freeze({
    action,
    prefix,
    scope,
    count,
    version,
    name,
    amount,
    days,
    approvalRequired,
    status,
    program,
    cardpool,
    reserve,
    decision,
    statusAction,
    expiresAt,
    member,
    reason,
    proof,
    approval,
    assurance: context.session.assurance.level,
    busy: mutation.isPending,
    error: mutation.error ? presentError(mutation.error).message : approvalError,
    actions,
  });
}

export type VoucherActionViewModel = ReturnType<typeof useVoucherActionViewModel>;
