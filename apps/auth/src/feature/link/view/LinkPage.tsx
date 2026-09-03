import { AlertCircle } from 'lucide-react';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { Alert } from '../../../shared/ui/Alert';
import { Loading } from '../../../shared/ui/Loading';
import { LINK_GUIDANCE } from '../model/Link';
import type { LinkState } from '../viewmodel/LinkViewModel';

export function LinkPage({ state, onBack }: Readonly<{ state: LinkState; onBack: () => void }>) {
  return <AuthShell><AuthCard stage={2} onBack={onBack}>{state.kind === 'loading' ? <Loading label="正在读取身份关联…" /> : state.kind === 'failed' ? <Alert failure={state.failure} onAction={onBack} /> : <section className="authstatus"><AlertCircle className="authstatusicon authstatuswarning" /><h1>{LINK_GUIDANCE.title}</h1><p>{LINK_GUIDANCE.detail}</p>{state.kind === 'ready' ? <p role="status">当前账号已有 {state.snapshot.links.length} 个身份关联，系统不会自动合并。</p> : <p role="status">当前会话未发现可直接处理的身份关联。</p>}</section>}</AuthCard></AuthShell>;
}
