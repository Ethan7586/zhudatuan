import { LoaderCircle } from 'lucide-react';

export function Loading({ label = '正在安全加载…' }: Readonly<{ label?: string }>) {
  return (
    <div className="authloading" role="status" aria-live="polite">
      <LoaderCircle aria-hidden="true" />
      {label}
    </div>
  );
}
