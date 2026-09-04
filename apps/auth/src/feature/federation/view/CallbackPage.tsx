import { RefreshCw } from 'lucide-react';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';

export function CallbackPage({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <AuthShell>
      <AuthCard stage={2} onBack={onBack}>
        <Status title="正在完成企业登录" detail="身份提供方回调由服务端安全处理，请勿关闭当前页面。" />
      </AuthCard>
    </AuthShell>
  );
}

function Status({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <section className="authstatus">
      <RefreshCw className="authstatusicon authspin" />
      <h1>{title}</h1>
      <p role="status" aria-live="polite">
        {detail}
      </p>
    </section>
  );
}
