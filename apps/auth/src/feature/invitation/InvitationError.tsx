import { AlertCircle } from 'lucide-react';

export function InvitationError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="alert" aria-live="assertive">
      <span className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        {message}
      </span>
    </div>
  );
}
