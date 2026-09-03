import { CircleAlert, Headphones, LoaderCircle, MessageSquarePlus } from 'lucide-react';
import type { useSupportViewModel } from '../viewmodel/SupportViewModel';
import type { SupportPriority } from '../model/SupportCase';
import './Support.css';

export function SupportPage({ viewmodel }: Readonly<{ viewmodel: ReturnType<typeof useSupportViewModel> }>) {
  const { state, items, subject, message, priority, busy, error, actions } = viewmodel;
  return (
    <section className="sw-web-container mx-auto max-w-[1240px] px-3 py-5 text-xs">
      <header className="mb-4">
        <p className="font-bold tracking-[.18em] text-[var(--sw-brand)]">智慧翼 · 客户服务</p>
        <h1 className="mt-1 text-xl font-black">客服中心</h1>
        <p className="mt-1 text-gray-500">发起真实服务工单，并持续跟踪客服回复与服务时限。</p>
      </header>
      {error ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />{error}
          {state === 'failed' ? <button type="button" onClick={actions.refresh} className="ml-auto underline">重试</button> : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[.75fr_1.25fr]">
        <form onSubmit={(event) => void actions.submit(event)} className="h-fit rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-black"><MessageSquarePlus size={18} />创建工单</h2>
          <label className="mt-4 block font-bold">问题标题
            <input value={subject} maxLength={120} onChange={(event) => actions.changeSubject(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="mt-3 block font-bold">优先级
            <select value={priority} onChange={(event) => actions.changePriority(event.target.value as SupportPriority)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">
              <option value="low">低</option><option value="normal">普通</option><option value="high">高</option><option value="urgent">紧急</option>
            </select>
          </label>
          <label className="mt-3 block font-bold">详细描述
            <textarea value={message} maxLength={4000} rows={6} onChange={(event) => actions.changeMessage(event.target.value)} className="mt-1 w-full resize-y rounded-lg border px-3 py-2 font-normal" />
          </label>
          <button disabled={busy || !subject.trim() || !message.trim()} className="mt-4 w-full rounded-lg bg-[var(--sw-brand)] px-4 py-2.5 font-bold text-white disabled:opacity-50">{busy ? '正在提交…' : '提交工单'}</button>
        </form>
        <div className="space-y-2">
          <h2 className="mb-3 flex items-center gap-2 text-base font-black"><Headphones size={18} />我的工单</h2>
          {state === 'loading' ? <State text="正在读取工单…" /> : null}
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => actions.open(item.id)} className="block w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-200 focus-visible:outline-2">
              <div className="flex items-center justify-between gap-3"><b className="text-sm">{item.subject}</b><span className="rounded-full bg-blue-50 px-2 py-1 font-bold text-[var(--sw-brand)]">{stateLabel(item.state)}</span></div>
              <p className="mt-2 text-gray-500">{priorityLabel(item.priority)} · 更新于 {format(item.updatedAt)}</p>
              <p className="mt-2 text-gray-400">响应期限 {format(item.responseDueAt)} · 解决期限 {format(item.resolutionDueAt)}</p>
            </button>
          ))}
          {state === 'empty' ? <State text="暂无服务工单，可在左侧创建" /> : null}
        </div>
      </div>
    </section>
  );
}

function State({ text }: Readonly<{ text: string }>) {
  return <div role="status" className="grid min-h-32 place-items-center rounded-xl border border-dashed bg-white text-gray-400"><span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={17} />{text}</span></div>;
}
function stateLabel(value: string) { return ({ open: '待处理', assigned: '已分配', waiting: '待您回复', resolved: '已解决', closed: '已关闭' } as Record<string, string>)[value] ?? '待识别状态'; }
function priorityLabel(value: string) { return ({ low: '低优先级', normal: '普通', high: '高优先级', urgent: '紧急' } as Record<string, string>)[value] ?? '普通'; }
function format(value: string) { return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
