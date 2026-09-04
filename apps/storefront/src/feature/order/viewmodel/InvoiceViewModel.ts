import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { DownloadInvoice } from '../application/DownloadInvoice';
import { ReadInvoices } from '../application/ReadInvoices';
import { invoiceQuery } from '../application/InvoiceQuery';

export function useInvoiceViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const reader = useRef(new ReadInvoices(dependencies.invoice));
  const downloader = useRef(new DownloadInvoice(dependencies.invoice));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const query = useQuery({ queryKey: invoiceQuery(session.scope || 'guest'), queryFn: ({ signal }) => reader.current.execute(required(session.session), signal), enabled: session.status === 'authenticated' });
  const download = async (id: string) => {
    if (!session.session) return;
    setBusy(id);
    setMessage(null);
    try {
      const value = await downloader.current.execute(session.session, id);
      const link = document.createElement('a');
      link.href = value.url;
      link.download = value.filename;
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (cause) {
      setMessage(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  };
  return Object.freeze({
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : query.data?.length === 0 ? ('empty' as const) : ('ready' as const),
    invoices: query.data ?? Object.freeze([]),
    busy,
    message: message ?? (query.isError ? '发票记录加载失败' : null),
    actions: Object.freeze({ download }),
  });
}
function required<T>(value: T | null): T {
  if (!value) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
