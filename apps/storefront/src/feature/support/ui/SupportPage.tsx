import { CircleAlert, Headphones, LoaderCircle, MessageSquarePlus } from 'lucide-react';
import { presentError } from '@shop/presentation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../../../shared/runtime/SessionContext';
import { supportQuery } from '../application/SupportQuery';
import { CreateCase } from '../application/CreateCase';
import { readCases } from '../application/ReadCases';
import type { SupportPriority } from '../model/SupportCase';
import './Support.css';

export function SupportPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const queryClient = useQueryClient();
  const command = useRef(new CreateCase());
  const topic = topicCopy(search.get('topic'));
  const [subject, setSubject] = useState(topic.subject);
  const [message, setMessage] = useState(topic.message);
  const [priority, setPriority] = useState<SupportPriority>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = session.scope || 'guest';
  const query = useQuery({ queryKey: supportQuery(scope), queryFn: ({ signal }) => readCases(required(session.session), signal), enabled: session.status === 'authenticated' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session.session) return;
    setBusy(true);
    setError(null);
    try {
      const id = await command.current.execute(session.session, subject, message, priority);
      await queryClient.invalidateQueries({ queryKey: supportQuery(scope) });
      void navigate(`/support/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(presentError(cause).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sw-web-container mx-auto max-w-[1240px] px-3 py-5 text-xs">
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">SMART WING SERVICE</p>
        <h1 className="mt-1 text-xl font-black">客服中心</h1>
        <p className="mt-1 text-gray-500">发起真实服务工单，并持续跟踪客服回复与 SLA。</p>
      </header>
      {error || query.isError ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />
          {error ?? '工单加载失败'}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
        <form onSubmit={(event) => void submit(event)} className="h-fit rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black">
            <MessageSquarePlus size={18} />
            创建工单
          </h2>
          <label className="mt-4 block font-bold">
            问题标题
            <input value={subject} maxLength={120} onChange={(event) => setSubject(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 block font-bold">
            优先级
            <select value={priority} onChange={(event) => setPriority(event.target.value as SupportPriority)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">
              <option value="low">低</option>
              <option value="normal">普通</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </label>
          <label className="mt-3 block font-bold">
            详细描述
            <textarea value={message} maxLength={4000} rows={6} onChange={(event) => setMessage(event.target.value)} className="mt-1 w-full resize-y rounded-lg border px-3 py-2 font-normal" />
          </label>
          <button disabled={busy} className="mt-4 w-full rounded-lg bg-[var(--sw-brand)] px-4 py-2.5 font-bold text-white disabled:opacity-50">
            {busy ? '正在提交…' : '提交工单'}
          </button>
        </form>
        <div className="space-y-2">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black">
            <Headphones size={18} />
            我的工单
          </h2>
          {query.isPending ? <State text="正在读取工单…" /> : null}
          {query.data?.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => void navigate(`/support/${encodeURIComponent(item.id)}`)}
              className="block w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-200 focus-visible:outline-2"
            >
              <div className="flex items-center justify-between gap-3">
                <b className="text-sm">{item.subject}</b>
                <span className="rounded-full bg-blue-50 px-2 py-1 font-bold text-[var(--sw-brand)]">{stateLabel(item.state)}</span>
              </div>
              <p className="mt-2 text-gray-500">
                {priorityLabel(item.priority)} · 更新于 {format(item.updatedAt)}
              </p>
              <p className="mt-2 text-gray-400">
                响应期限 {format(item.responseDueAt)} · 解决期限 {format(item.resolutionDueAt)}
              </p>
            </button>
          ))}
          {query.data?.items.length === 0 ? <State text="暂无服务工单" /> : null}
        </div>
      </div>
    </section>
  );
}

function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
function State({ text: value }: { readonly text: string }) {
  return (
    <div role="status" className="grid min-h-32 place-items-center rounded-xl border border-dashed bg-white text-gray-400">
      <span className="inline-flex items-center gap-2">
        <LoaderCircle className="animate-spin" size={17} />
        {value}
      </span>
    </div>
  );
}
function stateLabel(value: string) {
  return ({ open: '待处理', assigned: '已分配', waiting: '待您回复', resolved: '已解决', closed: '已关闭' } as Record<string, string>)[value] ?? value;
}
function priorityLabel(value: string) {
  return ({ low: '低优先级', normal: '普通', high: '高优先级', urgent: '紧急' } as Record<string, string>)[value] ?? value;
}
function format(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
function topicCopy(value: string | null): Readonly<{ subject: string; message: string }> {
  return (
    (
      {
        welfare: { subject: '咨询企业福利解决方案', message: '请说明企业规模、福利场景和希望解决的问题。' },
        supplier: { subject: '咨询供应商入驻标准', message: '请提供企业名称、商品品类、资质和合作诉求。' },
        distributor: { subject: '咨询分销服务商政策', message: '请提供所在区域、服务能力和合作诉求。' },
        delivery: { subject: '咨询配送时效与运费', message: '请提供订单号、收货区域和需要确认的问题。' },
        voucher: { subject: '申请虚拟卡券挂失或补发', message: '请提供相关订单号及卡券异常情况，请勿提交完整卡密。' },
        verification: { subject: '线下门店核销维权', message: '请提供订单号、门店、核销时间和问题说明。' },
      } as Record<string, Readonly<{ subject: string; message: string }>>
    )[value ?? ''] ?? { subject: '', message: '' }
  );
}
