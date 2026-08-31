import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function LoginAlert({ error, notice }: Readonly<{ error?: string; notice?: string }>) {
  if (error)
    return (
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="alert" aria-live="assertive">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="flex-1">{error}</p>
      </div>
    );
  if (notice)
    return (
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="status" aria-live="polite">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <p className="flex-1">{notice}</p>
      </div>
    );
  return null;
}
