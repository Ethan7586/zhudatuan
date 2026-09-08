import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { hasFailureCode, presentError } from '@shop/presentation';
import { useDependencies } from '../../../app/DependencyContext';
import { useSession } from '../../../entity/session/viewmodel/SessionContext';
import { DownloadInvoice } from '../application/DownloadInvoice';
import { ReadInvoices } from '../application/ReadInvoices';
import { invoiceQuery } from '../application/InvoiceQuery';
import { startInvoiceDownload, verifyInvoiceDownload } from '../application/InvoiceDownloadPolicy';
import { PendingAction } from '../../../shared/action/PendingAction';

export function useInvoiceViewModel() {
  const dependencies = useDependencies();
  const session = useSession();
  const reader = useRef(new ReadInvoices(dependencies.invoice));
  const downloader = useRef(new DownloadInvoice(dependencies.invoice));
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const pending = useRef(new PendingAction());
  const query = useQuery({ queryKey: invoiceQuery(session.query.scoped), queryFn: ({ signal }) => reader.current.execute(required(session.session), signal), enabled: session.status === 'authenticated' });
  const download = async (id: string, retry = false) => {
    if (!session.session) return;
    setBusy(id);
    setMessage(null);
    try {
      const value = verifyInvoiceDownload(await downloader.current.execute(session.session, id));
      startInvoiceDownload(value);
      pending.current.clear();
    } catch (cause) {
      if (!retry && hasFailureCode(cause, 'STEPUP_REQUIRED')) {
        pending.current.schedule(() => download(id, true));
        setVerification(true);
      } else setMessage(presentError(cause).message);
    } finally {
      setBusy(null);
    }
  };
  return Object.freeze({
    state: query.isPending ? ('loading' as const) : query.isError ? ('failed' as const) : query.data?.length === 0 ? ('empty' as const) : ('ready' as const),
    invoices: query.data ?? Object.freeze([]),
    busy,
    message: message ?? (query.isError ? '发票记录加载失败' : null),
    verification,
    actions: Object.freeze({
      download,
      retry: query.refetch,
      verified: () => {
        setVerification(false);
        pending.current.resume();
      },
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
