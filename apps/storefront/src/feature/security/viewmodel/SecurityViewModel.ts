import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { ChangeMobile } from '../application/ChangeMobile';
import { ChangePassword } from '../application/ChangePassword';
import { ReadSecurity } from '../application/ReadSecurity';
import { RevokeSession } from '../application/RevokeSession';
import { securityQuery } from './SecurityQueryKey';
import { textValue } from '../../../shared/format/Text';
import { PendingAction } from '../../../shared/action/PendingAction';

export function useSecurityViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const cache = useQueryClient();
  const reader = useRef(new ReadSecurity(dependencies.security));
  const password = useRef(new ChangePassword(dependencies.security));
  const mobile = useRef(new ChangeMobile(dependencies.security));
  const revoke = useRef(new RevokeSession(dependencies.security));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [challenge, setChallenge] = useState('');
  const [mobileValue, setMobileValue] = useState('');
  const [verification, setVerification] = useState(false);
  const retryAction = useRef(new PendingAction());
  const query = useQuery({ queryKey: securityQuery(session.query.scoped), queryFn: ({ signal }) => reader.current.execute(required(session.session), signal), enabled: session.status === 'authenticated' });
  const refresh = () => cache.invalidateQueries({ queryKey: securityQuery(session.query.scoped) });
  async function run(key: string, action: () => Promise<void>, success?: () => void) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      success?.();
      await refresh();
    } catch (cause) {
      if (hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        retryAction.current.schedule(() => run(key, action, success));
        setVerification(true);
      } else setMessage(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }
  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(
      'password',
      () => password.current.execute(required(session.session), textValue(data.get('current')), textValue(data.get('next')), textValue(data.get('confirmation'))),
      () => form.reset()
    );
  }
  async function changeMobile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!challenge) return run('mobile', async () => setChallenge(await mobile.current.start(required(session.session), mobileValue)));
    await run(
      'mobile',
      () => mobile.current.complete(required(session.session), mobileValue, challenge, textValue(new FormData(form).get('code'))),
      () => {
        setChallenge('');
        setMobileValue('');
        form.reset();
      }
    );
  }
  const revokeSession = (target: string) => run(`session:${target}`, () => revoke.current.execute(required(session.session), target).then(() => undefined));
  const verified = () => {
    setVerification(false);
    retryAction.current.resume();
  };
  return Object.freeze({
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : ('ready' as const),
    security: query.data ?? null,
    busy,
    message: message ?? (query.isError ? '安全信息加载失败' : null),
    challenge,
    mobileValue,
    verification,
    actions: Object.freeze({
      changePassword,
      changeMobile,
      changeMobileValue: setMobileValue,
      cancelMobile: () => {
        setChallenge('');
        setMobileValue('');
        setMessage(null);
      },
      revokeSession,
      retry: query.refetch,
      verified,
      closeVerification: () => {
        setVerification(false);
        retryAction.current.clear();
      },
    }),
  });
}
function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
