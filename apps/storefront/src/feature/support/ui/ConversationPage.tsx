import { ArrowLeft, CircleAlert, LoaderCircle, Paperclip, Send } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../../shared/runtime/SessionContext';
import { supportQuery } from '../application/SupportQuery';
import { readConversation } from '../application/ReadConversation';
import { SendMessage } from '../application/SendMessage';
import { UploadAttachment } from '../application/UploadAttachment';

export function ConversationPage({ caseId }: { readonly caseId: string }) {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const send = useRef(new SendMessage());
  const upload = useRef(new UploadAttachment());
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scope = session.scope || 'guest';
  const key = supportQuery(scope, caseId);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => readConversation(required(session.session), caseId, signal), enabled: session.status === 'authenticated' });
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session.session) return;
    setBusy(true);
    setError(null);
    try {
      await send.current.execute(session.session, caseId, message);
      setMessage('');
      await refresh();
    } catch (cause) {
      setError(text(cause, '消息发送失败'));
    } finally {
      setBusy(false);
    }
  }
  async function attach(file: File | undefined) {
    if (!session.session || !file) return;
    setBusy(true);
    setError(null);
    try {
      await upload.current.execute(session.session, caseId, file);
      await refresh();
    } catch (cause) {
      setError(text(cause, '附件上传失败'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="sw-web-container mx-auto max-w-[900px] px-3 py-5 text-xs">
      <header className="mb-4 flex items-center gap-3">
        <button type="button" aria-label="返回客服中心" onClick={() => void navigate('/support')} className="grid h-9 w-9 place-items-center rounded-full border bg-white">
          <ArrowLeft size={17} />
        </button>
        <div>
          <h1 className="text-xl font-black">工单会话</h1>
          <p className="text-gray-500">{caseId}</p>
        </div>
      </header>
      {error || query.isError ? (
        <div role="alert" className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 font-bold text-red-700">
          <CircleAlert size={16} />
          {error ?? '会话加载失败'}
        </div>
      ) : null}
      <div className="min-h-[420px] space-y-3 rounded-xl border bg-gray-50 p-4">
        {query.isPending ? (
          <p role="status" className="flex items-center justify-center gap-2 py-20 text-gray-400">
            <LoaderCircle className="animate-spin" size={17} />
            正在读取会话…
          </p>
        ) : null}
        {query.data?.items.map((item) => (
          <article key={item.id} className={`max-w-[82%] rounded-xl px-3 py-2 shadow-sm ${item.authorType === 'member' ? 'ml-auto bg-[var(--sw-brand)] text-white' : 'bg-white text-gray-700'}`}>
            <p className="whitespace-pre-wrap break-words leading-5">{item.body}</p>
            <time className={`mt-1 block text-[10px] ${item.authorType === 'member' ? 'text-blue-100' : 'text-gray-400'}`}>{format(item.createdAt)}</time>
          </article>
        ))}
        {query.data?.attachments.map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg border bg-white p-2 text-gray-500">
            <Paperclip size={14} />
            <span className="min-w-0 flex-1 truncate">{item.contentType}</span>
            <span>{Math.ceil(item.size / 1024)}KB</span>
          </div>
        ))}
        {query.data && query.data.items.length === 0 ? <p className="py-20 text-center text-gray-400">尚无消息</p> : null}
      </div>
      <form onSubmit={(event) => void submit(event)} className="mt-3 flex items-end gap-2 rounded-xl border bg-white p-3">
        <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border" aria-label="上传附件">
          <Paperclip size={17} />
          <input
            type="file"
            className="sr-only"
            accept="image/jpeg,image/png,application/pdf,text/plain"
            disabled={busy}
            onChange={(event) => {
              void attach(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <textarea aria-label="消息内容" value={message} onChange={(event) => setMessage(event.target.value)} rows={2} maxLength={4000} className="min-h-10 flex-1 resize-y rounded-lg border px-3 py-2" />
        <button type="submit" disabled={busy || !message.trim()} className="inline-flex h-10 items-center gap-1 rounded-lg bg-[var(--sw-brand)] px-4 font-bold text-white disabled:opacity-50">
          <Send size={15} />
          发送
        </button>
      </form>
    </section>
  );
}

function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
function format(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}
function text(cause: unknown, fallback: string) {
  return cause instanceof Error && cause.message ? cause.message : fallback;
}
