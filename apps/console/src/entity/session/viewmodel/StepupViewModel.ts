import { safeQueryError } from '@shop/presentation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDependencies } from '../../../app/DependencyContext';
import { readActionRequest } from '../../../shared/security/ActionRequest';
import type { SessionCommandContext } from '../model/Stepup';

export interface StepupInput {
  readonly open: boolean;
  readonly accessVersion: number;
  readonly phoneMasked: string | null;
  readonly csrf?: string;
  readonly onClose: () => void;
  readonly onComplete: () => void;
}

export function useStepupViewModel(input: StepupInput) {
  const dependencies = useDependencies();
  const { open, accessVersion, phoneMasked, csrf, onClose, onComplete } = input;
  const [challenge, setChallenge] = useState<string>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [approval, setApproval] = useState('');
  const [purpose, setPurpose] = useState<'session' | 'review'>('session');
  const [proof, setProof] = useState<string>();
  const [expiresAt, setExpiresAt] = useState<string>();
  const running = useRef(false);
  const requestIdentity = useRef(dependencies.session.createIdentity());
  const completeIdentity = useRef(dependencies.session.createIdentity());

  useEffect(() => {
    if (open) return;
    setChallenge(undefined);
    setCode('');
    setError(undefined);
    setApproval('');
    setPurpose('session');
    setProof(undefined);
    setExpiresAt(undefined);
  }, [open]);

  const run = useCallback(async (task: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (cause) {
      setError(safeQueryError(cause instanceof Error ? cause : new Error('STEPUP_FAILED')) ?? '验证失败，请重试。');
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);
  const request = useCallback(
    () =>
      run(async () => {
        if (phoneMasked === null) throw new Error('STEPUP_DESTINATION_MISSING');
        if (purpose === 'review' && approval.trim() === '') throw new Error('ACTION_REQUEST_INVALID');
        const action = purpose === 'review' ? readActionRequest(approval) : undefined;
        const result = await dependencies.session.startStepup.execute(commandContext(accessVersion, csrf, requestIdentity.current), action);
        setChallenge(result.id);
        setCode('');
        requestIdentity.current = dependencies.session.createIdentity();
        completeIdentity.current = dependencies.session.createIdentity();
      }),
    [accessVersion, approval, csrf, dependencies.session, phoneMasked, purpose, run]
  );
  const complete = useCallback(
    () =>
      run(async () => {
        if (challenge === undefined) return;
        const result = await dependencies.session.completeStepup.execute(commandContext(accessVersion, csrf, completeIdentity.current), challenge, code.trim());
        if ('proof' in result) {
          setProof(result.proof);
          setExpiresAt(result.expiresAt);
          return;
        }
        onComplete();
      }),
    [accessVersion, challenge, code, csrf, dependencies.session, onComplete, run]
  );
  const selectPurpose = useCallback((value: 'session' | 'review') => {
    setPurpose(value);
    if (value === 'session') setApproval('');
    requestIdentity.current = dependencies.session.createIdentity();
  }, [dependencies.session]);
  const actions = useMemo(
    () =>
      Object.freeze({
        close: onClose,
        request: () => void request(),
        complete: () => void complete(),
        selectPurpose,
        updateApproval: (value: string) => {
          setApproval(value.trim());
          requestIdentity.current = dependencies.session.createIdentity();
        },
        updateCode: (value: string) => {
          setCode(value.replace(/\D/g, '').slice(0, 6));
          completeIdentity.current = dependencies.session.createIdentity();
        },
        copyProof: () => proof && void run(() => navigator.clipboard.writeText(proof)),
      }),
    [complete, dependencies.session, onClose, proof, request, run, selectPurpose]
  );
  return Object.freeze({
    open,
    phoneMasked,
    challenge,
    code,
    busy,
    error,
    approval,
    purpose,
    proof,
    expires: expiresAt ? new Date(expiresAt).toLocaleString('zh-CN') : '未知',
    actions,
  });
}

export type StepupViewModel = ReturnType<typeof useStepupViewModel>;

function commandContext(accessVersion: number, csrf: string | undefined, idempotencyKey: string): SessionCommandContext {
  return { accessVersion, idempotencyKey, ...(csrf === undefined ? {} : { csrf }) };
}
