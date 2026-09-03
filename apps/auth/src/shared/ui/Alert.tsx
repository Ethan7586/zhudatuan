import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { chineseReference, type FailureView } from '@shop/presentation';
import { useEffect, useRef, useState } from 'react';

export function Alert({ failure, notice, onAction }: Readonly<{ failure?: FailureView; notice?: string; onAction?: () => void }>) {
  const summary = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCopied(false);
    if (failure) summary.current?.focus();
  }, [failure]);
  if (failure)
    return (
      <div ref={summary} className="authalert" data-severity={failure.severity} role="alert" aria-live="assertive" tabIndex={-1}>
        <AlertCircle className="authalerticon" aria-hidden="true" />
        <div className="authalertcopy">
          <strong>{failure.title}</strong>
          <p>{failure.message}</p>
          {failure.requestId ? <small>{chineseReference('请求', failure.requestId)}</small> : null}
        </div>
        {failure.requestId ? (
          <button type="button" aria-label="复制请求编号" onClick={() => void copy(failure.requestId ?? '').then(setCopied)}>
            {copied ? '已复制' : '复制编号'}
          </button>
        ) : null}
        {onAction && failure.action.kind !== 'none' ? (
          <button type="button" onClick={onAction}>
            {failure.action.label}
          </button>
        ) : null}
      </div>
    );
  if (notice)
    return (
      <div className="authnotice" role="status" aria-live="polite">
        <CheckCircle2 className="authalerticon" aria-hidden="true" />
        <p>{notice}</p>
      </div>
    );
  return null;
}

async function copy(value: string): Promise<boolean> {
  if (navigator.clipboard === undefined) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
