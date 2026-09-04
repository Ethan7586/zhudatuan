import { Button } from '@shop/design';
import { AlertCircle, Link2, ShieldCheck, Unlink } from 'lucide-react';
import { AuthCard } from '../../../shell/AuthCard';
import { AuthShell } from '../../../shell/AuthShell';
import { Alert } from '../../../shared/ui/Alert';
import { Loading } from '../../../shared/ui/Loading';
import { providerLabel } from '../../federation';
import { LINK_GUIDANCE } from '../model/Link';
import type { LinkViewModel } from '../viewmodel/LinkViewModel';

export function LinkPage({ viewmodel, onBack }: Readonly<{ viewmodel: LinkViewModel; onBack: () => void }>) {
  const vm = viewmodel;
  if (vm.phase === 'conflict') return <Conflict onBack={onBack} />;
  return (
    <AuthShell>
      <AuthCard stage={2} onBack={onBack}>
        {vm.phase === 'loading' ? (
          <Loading label="正在读取身份绑定…" />
        ) : (
          <section className="authpanel linkworkspace" aria-busy={vm.busy || vm.phase === 'redirecting'}>
            <header>
              <h1>管理身份绑定</h1>
              <p>绑定后可使用对应企业身份登录；解除绑定不会删除账号。</p>
            </header>
            {vm.failure ? <Alert failure={vm.failure} onAction={vm.load} /> : null}
            {vm.notice ? <Alert notice={vm.notice} /> : null}
            <section className="linksection" aria-labelledby="linkedTitle">
              <div className="linkheading">
                <div><h2 id="linkedTitle">已绑定方式</h2><p>仅当前账号本人可以解除绑定。</p></div>
                <span>{vm.links.filter(({ status }) => status === 'active').length} 个</span>
              </div>
              {vm.links.filter(({ status }) => status === 'active').length === 0 ? (
                <p className="linkempty">尚未绑定企业身份。请从下方选择一种可用方式。</p>
              ) : (
                <ul className="linklist">
                  {vm.links.filter(({ status }) => status === 'active').map((link) => {
                    const provider = vm.providers.find(({ id }) => id === link.provider);
                    return (
                      <li key={link.id}>
                        <span className="linkicon"><ShieldCheck aria-hidden="true" /></span>
                        <span><strong>{provider ? providerLabel(provider.type) : '企业身份'}</strong><small>已验证并绑定</small></span>
                        <Button tone="danger" onPress={() => vm.askRevoke(link)} isDisabled={vm.busy}>解除绑定</Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            {vm.available.length > 0 ? (
              <section className="linksection" aria-labelledby="newLinkTitle">
                <div className="linkheading"><div><h2 id="newLinkTitle">绑定新方式</h2><p>需要完成当前账号安全核验和身份提供方授权。</p></div></div>
                <label className="authfield" htmlFor="linkProvider">身份方式
                  <select id="linkProvider" className="authinput" value={vm.selected} onChange={(event) => vm.select(event.target.value)} disabled={vm.busy}>
                    {vm.available.map((provider) => <option key={provider.id} value={provider.id}>{providerLabel(provider.type)}</option>)}
                  </select>
                </label>
                <Button tone="primary" onPress={vm.create} isDisabled={vm.busy || !vm.selected}>
                  <Link2 aria-hidden="true" />{vm.phase === 'redirecting' ? '正在前往验证…' : '绑定所选方式'}
                </Button>
              </section>
            ) : null}
            {vm.pending ? (
              <section className="linkconfirm" role="alertdialog" aria-labelledby="unlinkTitle" aria-describedby="unlinkDescription">
                <Unlink aria-hidden="true" />
                <div><h2 id="unlinkTitle">确认解除绑定？</h2><p id="unlinkDescription">解除后不能再用该方式登录；账号、密码和其他绑定保持不变。</p></div>
                <div><Button onPress={vm.cancelRevoke} isDisabled={vm.busy}>取消</Button><Button tone="danger" onPress={vm.revoke} isDisabled={vm.busy}>{vm.busy ? '正在解除…' : '确认解除'}</Button></div>
              </section>
            ) : null}
          </section>
        )}
      </AuthCard>
    </AuthShell>
  );
}

function Conflict({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <AuthShell>
      <AuthCard stage={2} onBack={onBack}>
        <section className="authstatus">
          <AlertCircle className="authstatusicon authstatuswarning" aria-hidden="true" />
          <h1>{LINK_GUIDANCE.title}</h1>
          <p>{LINK_GUIDANCE.detail}</p>
          <Button tone="primary" onPress={onBack}>返回安全登录</Button>
        </section>
      </AuthCard>
    </AuthShell>
  );
}
