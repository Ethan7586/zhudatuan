import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { MEMBER_CODE_SECONDS } from '@shop/contract/verification';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ROUTES } from '../../../generated/RouteBinding';
import { PendingAction } from '../../../shared/action/PendingAction';
import { useMemberIdentity } from '../../account';
import { IssueMemberCode } from '../application/IssueMemberCode';
import { RevokeMemberCode } from '../application/RevokeMemberCode';
import type { MemberCode } from '../model/MemberCode';
import { memberCodeRefreshWait, memberCodeRemaining } from '../model/MemberCode';

type MemberCodeState = 'loading' | 'ready' | 'hidden' | 'needsmobile' | 'failed';
type DisplayMode = 'qrcode' | 'barcode';

export function useMemberCodeViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const identity = useMemberIdentity();
  const navigate = useNavigate();
  const issuer = useRef(new IssueMemberCode(dependencies.membercode));
  const revoker = useRef(new RevokeMemberCode(dependencies.membercode));
  const pending = useRef(new PendingAction());
  const issueKey = useRef(crypto.randomUUID());
  const active = useRef(false);
  const attempted = useRef(false);
  const refreshed = useRef('');
  const [code, setCode] = useState<MemberCode | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const [display, setDisplay] = useState<DisplayMode>('qrcode');
  const [bright, setBright] = useState(false);
  const [now, setNow] = useState(Date.now());
  const membership = session.session?.membership ?? '';
  const scope = session.session?.scope.id ?? '';

  useEffect(() => {
    issueKey.current = crypto.randomUUID();
    attempted.current = false;
    refreshed.current = '';
    pending.current.clear();
    setCode(null);
    setHidden(false);
    setError(null);
    setVerification(false);
  }, [membership, scope]);

  useEffect(() => {
    if (!code || hidden) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [code, hidden]);

  const remaining = code ? memberCodeRemaining(code, now) : 0;
  const refreshWait = code ? memberCodeRefreshWait(code, now) : 0;
  const identityReady = identity.profileState === 'ready';

  useEffect(() => {
    if (session.status !== 'authenticated' || !identityReady || !identity.user.phoneVerified || hidden || code || attempted.current) return;
    attempted.current = true;
    void issue(false);
  }, [code, hidden, identity.user.phoneVerified, identityReady, membership, scope, session.status]);

  useEffect(() => {
    if (!code || hidden || remaining > 0 || refreshed.current === code.challenge) return;
    refreshed.current = code.challenge;
    void issue(true);
  }, [code, hidden, remaining]);

  async function issue(newKey: boolean): Promise<void> {
    const current = session.session;
    if (!current || active.current) return;
    if (newKey) issueKey.current = crypto.randomUUID();
    active.current = true;
    setBusy(true);
    setError(null);
    try {
      const issued = await issuer.current.execute(current, issueKey.current);
      setCode(issued);
      setNow(Date.now());
      setHidden(false);
      refreshed.current = '';
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        pending.current.schedule(() => issue(false));
        setVerification(true);
      } else {
        setError(presentError(cause).message);
      }
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function hide(): Promise<void> {
    const current = session.session;
    const visible = code;
    if (!current || !visible || active.current) return;
    active.current = true;
    setBusy(true);
    setError(null);
    try {
      await revoker.current.execute(current, visible, crypto.randomUUID());
      setCode(null);
      setHidden(true);
      attempted.current = true;
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        pending.current.schedule(hide);
        setVerification(true);
      } else {
        setError(presentError(cause).message);
      }
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  const state: MemberCodeState =
    identity.profileState === 'loading'
      ? 'loading'
      : identity.profileState === 'failed'
        ? 'failed'
        : !identity.user.phoneVerified
          ? 'needsmobile'
          : hidden
            ? 'hidden'
            : code && remaining > 0
              ? 'ready'
              : error
                ? 'failed'
                : 'loading';

  return Object.freeze({
    state,
    code,
    remaining,
    duration: MEMBER_CODE_SECONDS,
    refreshWait,
    busy,
    error: identity.profileState === 'failed' ? identity.profileMessage : error,
    verification,
    display,
    bright,
    user: identity.user,
    currentMall: identity.currentMall,
    actions: Object.freeze({
      refresh: () => {
        if (refreshWait > 0) return identity.showToast(`${refreshWait} 秒后即可刷新会员码`, 'info');
        void issue(true);
      },
      retry: () => {
        attempted.current = true;
        void issue(false);
      },
      hide: () => void hide(),
      show: () => {
        attempted.current = true;
        void issue(true);
      },
      verifyMobile: () => void navigate(ROUTES.storesecurity),
      closeVerification: () => {
        pending.current.clear();
        setVerification(false);
        setError('完成二次验证后，才会展示会员码。');
      },
      verified: () => {
        setVerification(false);
        pending.current.resume();
      },
      display: setDisplay,
      brightness: () => setBright((value) => !value),
    }),
  });
}
