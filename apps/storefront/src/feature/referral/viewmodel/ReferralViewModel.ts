import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { routePath, ROUTES } from '../../../generated/RouteBinding';
import { parseMinor } from '../../../shared/format/Money';
import { textValue } from '../../../shared/format/Text';
import { storefrontUrl } from '../../../shared/navigation/StorefrontUrl';
import { PendingAction } from '../../../shared/action/PendingAction';
import { ReferralCommands } from '../application/ReferralCommands';
import { ReferralReader } from '../application/ReferralReader';
import type { ReferralLink } from '../model/Referral';
import { referralEarningsQuery, referralQuery, referralWithdrawalsQuery } from './ReferralQueryKey';

export function useReferralViewModel(enabled = true) {
  const dependencies = useDependencies();
  const session = useSession();
  const cache = useQueryClient();
  const reader = useRef(new ReferralReader(dependencies.referral));
  const commands = useRef(new ReferralCommands(dependencies.referral));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [link, setLink] = useState<ReferralLink | null>(null);
  const [verification, setVerification] = useState(false);
  const pending = useRef(new PendingAction());
  const active = enabled && session.status === 'authenticated';
  const earnings = useInfiniteQuery({
    queryKey: referralEarningsQuery(session.query.scoped),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => reader.current.earnings(required(session.session), pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: active,
  });
  const withdrawals = useInfiniteQuery({
    queryKey: referralWithdrawalsQuery(session.query.scoped),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => reader.current.withdrawals(required(session.session), pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: active,
  });
  useEffect(() => {
    if (!enabled) setLink(null);
  }, [enabled]);
  const summary = earnings.data?.pages[0] ?? null;
  async function run(key: string, action: () => Promise<void>, success?: () => void, stepup = false) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      pending.current.clear();
      success?.();
      await cache.invalidateQueries({ queryKey: referralQuery(session.query.scoped) });
    } catch (cause) {
      if (stepup && hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        pending.current.schedule(() => run(key, action, success, stepup));
        setVerification(true);
      } else if (hasFailureCode(cause, 'REFERRAL_NOT_ELIGIBLE')) setMessage('当前还不是推荐官，可先提交申请；审核通过后即可生成专属链接。');
      else setMessage(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }
  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await run(
      'apply',
      async () => {
        const value = await commands.current.apply(required(session.session), { displayName: textValue(data.get('displayName')), mobile: textValue(data.get('mobile')), reason: textValue(data.get('reason')) });
        setMessage(value.status === 'active' ? '申请已通过，现在可以生成推荐链接。' : '申请已提交，审核通过后会在消息中心通知你。');
      },
      () => form.reset()
    );
  }
  async function generateLink(productId?: string) {
    setBusy('link');
    setMessage(null);
    try {
      const value = await reader.current.link(required(session.session), productId);
      const path = value.productId ? routePath('storeproduct', { productId: value.productId }) : ROUTES.storehome;
      setLink(Object.freeze({ ...value, url: storefrontUrl(path, { referral: value.token }) }));
    } catch (cause) {
      if (hasFailureCode(cause, 'REFERRAL_NOT_ELIGIBLE')) setMessage('审核通过后才能生成推荐链接，请先提交推荐官申请。');
      else setMessage(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  }
  async function shareLink() {
    if (!link) return;
    try {
      const outcome = await dependencies.share.share({ title: '智慧翼福利商城', text: '我为你推荐智慧翼福利商城', url: link.url });
      session.showToast(outcome === 'shared' ? '推荐链接已分享' : '推荐链接已复制', 'success');
    } catch (cause) {
      session.showToast(presentError(cause).message, 'error');
    }
  }
  async function withdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!summary) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const key = crypto.randomUUID();
    await run(
      'withdraw',
      () =>
        commands.current
          .withdraw(
            required(session.session),
            {
              amountMinor: parseMinor(textValue(data.get('amount'))),
              currency: summary.currency,
              accountRef: textValue(data.get('accountRef')),
              expectedVersion: summary.version,
            },
            key
          )
          .then(() => undefined),
      () => form.reset(),
      true
    );
  }
  const verified = () => {
    setVerification(false);
    pending.current.resume();
  };
  return Object.freeze({
    state: earnings.isPending ? ('loading' as const) : earnings.isError ? ('failed' as const) : ('ready' as const),
    withdrawalState: withdrawals.isPending ? ('loading' as const) : withdrawals.isError ? ('failed' as const) : ('ready' as const),
    summary,
    commissions: earnings.data?.pages.flatMap((page) => page.items) ?? Object.freeze([]),
    withdrawals: withdrawals.data?.pages.flatMap((page) => page.items) ?? Object.freeze([]),
    hasMoreCommissions: earnings.hasNextPage,
    hasMoreWithdrawals: withdrawals.hasNextPage,
    loadingCommissions: earnings.isFetchingNextPage,
    loadingWithdrawals: withdrawals.isFetchingNextPage,
    message: message ?? (earnings.isError ? presentError(earnings.error).message : withdrawals.isError ? presentError(withdrawals.error).message : null),
    busy,
    link,
    verification,
    actions: Object.freeze({
      apply,
      withdraw,
      generateLink,
      shareLink,
      closeLink: () => setLink(null),
      retry: () => cache.invalidateQueries({ queryKey: referralQuery(session.query.scoped) }),
      loadCommissions: earnings.fetchNextPage,
      loadWithdrawals: withdrawals.fetchNextPage,
      verified,
      closeVerification: () => {
        pending.current.clear();
        setVerification(false);
      },
    }),
  });
}

function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
