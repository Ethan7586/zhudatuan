import { Building2 } from 'lucide-react';
import type { Provider } from '../model/Provider';

const LABELS: Readonly<Record<Provider['type'], string>> = Object.freeze({
  wechat: '微信登录',
  wecomcorp: '企业微信登录',
  wecomsuite: '企业微信服务商登录',
  oidc: '企业单点登录',
});

export function ProviderList({
  providers,
  busy,
  loading,
  failed,
  onSelect,
}: Readonly<{
  providers: readonly Provider[];
  busy: boolean;
  loading: boolean;
  failed: boolean;
  onSelect: (provider: Provider) => void;
}>) {
  if (loading)
    return (
      <p className="providerstate" role="status">
        正在加载企业登录方式…
      </p>
    );
  if (failed) return null;
  if (providers.length === 0) return <p className="providerstate">当前没有配置企业单点登录，可继续使用上方账号方式。</p>;
  return (
    <div className="providerlist" aria-label="企业登录方式">
      {providers.map((provider) => (
        <button key={provider.id} type="button" disabled={busy} onClick={() => onSelect(provider)} className="providerbutton">
          <Building2 aria-hidden="true" />
          {LABELS[provider.type]}
        </button>
      ))}
    </div>
  );
}
