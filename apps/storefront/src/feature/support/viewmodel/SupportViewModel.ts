import { useQuery, useQueryClient } from '@tanstack/react-query';
import { presentError } from '@shop/presentation';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import type { StorefrontSession } from '../../../entity/session';
import { CreateCase } from '../application/CreateCase';
import { ReadCases } from '../application/ReadCases';
import { supportQuery } from '../application/SupportQuery';
import type { SupportPriority } from '../model/SupportCase';

const topics: Readonly<Record<string, Readonly<{ subject: string; message: string }>>> = Object.freeze({
  welfare: { subject: '咨询企业福利解决方案', message: '请说明企业规模、福利场景和希望解决的问题。' },
  supplier: { subject: '咨询供应商入驻标准', message: '请提供企业名称、商品品类、资质和合作诉求。' },
  distributor: { subject: '咨询分销服务商政策', message: '请提供所在区域、服务能力和合作诉求。' },
  delivery: { subject: '咨询配送时效与运费', message: '请提供订单号、收货区域和需要确认的问题。' },
  voucher: { subject: '申请虚拟卡券挂失或补发', message: '请提供相关订单号及卡券异常情况，请勿提交完整卡密。' },
  verification: { subject: '线下门店核销维权', message: '请提供订单号、门店、核销时间和问题说明。' },
});

export function useSupportViewModel() {
  const dependencies = useDependencies();
  const runtime = useSession();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const cache = useQueryClient();
  const topic = topics[search.get('topic') ?? ''] ?? { subject: '', message: '' };
  const creator = useRef(new CreateCase(dependencies.support));
  const reader = useRef(new ReadCases(dependencies.support));
  const [subject, setSubject] = useState(topic.subject);
  const [message, setMessage] = useState(topic.message);
  const [priority, setPriority] = useState<SupportPriority>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = runtime.scope || 'guest';
  const key = useMemo(() => supportQuery(scope), [scope]);
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => reader.current.list(required(runtime.session), signal),
    enabled: runtime.status === 'authenticated',
  });

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!runtime.session || busy) return;
    setBusy(true);
    setError(null);
    try {
      const id = await creator.current.execute(runtime.session, subject, message, priority);
      await cache.invalidateQueries({ queryKey: key, exact: true });
      void navigate(`/support/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return Object.freeze({
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : query.data?.items.length ? ('ready' as const) : ('empty' as const),
    items: query.data?.items ?? Object.freeze([]),
    subject,
    message,
    priority,
    busy,
    error: error ?? (query.isError ? presentError(query.error).message : null),
    actions: Object.freeze({
      submit,
      changeSubject: setSubject,
      changeMessage: setMessage,
      changePriority: setPriority,
      open: (id: string) => void navigate(`/support/${encodeURIComponent(id)}`),
      refresh: () => void query.refetch(),
    }),
  });
}

function required(value: StorefrontSession | null): StorefrontSession {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
