import { Clock3, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Challenge } from '../model/Challenge';
import { challengePurposeLabel } from '../model/Challenge';
import { useRemainingSeconds } from '../viewmodel/ChallengeViewModel';

export function ChallengeStatus({ challenge }: Readonly<{ challenge: Challenge }>) {
  const validSeconds = useRemainingSeconds(challenge.expiresAt);
  const resendSeconds = useRemainingSeconds(challenge.retryAt);
  return (
    <section className="authchallengestatus" aria-label="验证码状态" role="status">
      <div>
        <ShieldCheck aria-hidden="true" />
        <span>验证用途</span>
        <strong>{challengePurposeLabel(challenge.purpose)}</strong>
      </div>
      <div>
        <Clock3 aria-hidden="true" />
        <span>有效期</span>
        <strong>{validSeconds > 0 ? `${formatDuration(validSeconds)} 后失效` : '已失效，请重新获取'}</strong>
        <small>{formatTime(challenge.expiresAt)}</small>
      </div>
      <div>
        <ShieldCheck aria-hidden="true" />
        <span>剩余尝试</span>
        <strong>{challenge.attemptsRemaining} 次</strong>
      </div>
      <div>
        <RefreshCw aria-hidden="true" />
        <span>重新发送</span>
        <strong>{resendSeconds > 0 ? `${resendSeconds} 秒后可用` : '现在可以重新发送'}</strong>
        <small>{formatTime(challenge.retryAt)}</small>
      </div>
    </section>
  );
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes} 分 ${String(remainder).padStart(2, '0')} 秒` : `${remainder} 秒`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
}
