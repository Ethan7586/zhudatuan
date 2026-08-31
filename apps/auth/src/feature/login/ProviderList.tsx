import { Building2 } from 'lucide-react';
import type { ProviderChoice } from '../../entity/authentication/AuthenticationState';

const LABELS: Readonly<Record<ProviderChoice['type'], string>> = Object.freeze({
  wechat: '微信登录',
  wecomcorp: '企业微信登录',
  wecomsuite: '企业微信服务商登录',
  oidc: '企业单点登录',
});

export function ProviderList({
  providers,
  busy,
  onSelect,
}: Readonly<{
  providers: readonly ProviderChoice[];
  busy: boolean;
  onSelect: (provider: ProviderChoice) => void;
}>) {
  if (providers.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-slate-100 pt-3" aria-label="企业登录方式">
      {providers.map((provider) => (
        <button
          key={provider.id}
          type="button"
          disabled={busy}
          onClick={() => onSelect(provider)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[var(--sw-brand)] hover:text-[var(--sw-brand)] disabled:opacity-50"
        >
          <Building2 className="h-4 w-4" />
          {LABELS[provider.type]}
        </button>
      ))}
    </div>
  );
}
