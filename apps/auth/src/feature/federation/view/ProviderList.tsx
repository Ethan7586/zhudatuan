import { Button } from '@shop/design';
import { Building2 } from 'lucide-react';
import type { Provider } from '../model/Provider';
import { providerLabel } from '../model/Provider';

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
  if (providers.length === 0) return null;
  return (
    <div className="providerlist" aria-label="企业登录方式">
      {providers.map((provider) => (
        <Button key={provider.id} isDisabled={busy} onPress={() => onSelect(provider)} className="providerbutton">
          <Building2 aria-hidden="true" />
          {providerLabel(provider.type, 'login')}
        </Button>
      ))}
    </div>
  );
}
