import { Button, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { FederationHealth, FederationProvider, FederationType } from '../model/Federation';
import type { FederationViewModel } from '../viewmodel/FederationViewModel';
import '../Federation.css';

export function FederationPage({ title, model }: Readonly<{ title: string; model: FederationViewModel }>) {
  return (
    <ResourcePanel
      eyebrow={chineseSectionLabel('联邦身份')}
      title={title}
      description="这里只展示当前租户已启用的联邦身份连接；客户端标识、密钥引用和密钥材料均不进入浏览器。"
      condition={model.condition}
      {...(model.error ? { error: model.error } : {})}
      retry={model.actions.refresh}
      actions={
        <Button onPress={model.actions.refresh} isDisabled={model.fetching}>
          {model.fetching ? '正在刷新…' : '刷新连接'}
        </Button>
      }
      notice={
        <section className="federationnotice">
          <span aria-hidden="true">盾</span>
          <div>
            <strong>租户隔离的联邦身份中心</strong>
            <p>管理页使用受会话、Scope、Capability 和 Permission 共同保护的专用读接口；匿名登录提供方发现接口不再用于后台管理。</p>
          </div>
        </section>
      }
    >
      {model.data ? (
        <div className="federationgrid">
          {model.data.items.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} model={model} />
          ))}
        </div>
      ) : null}
      {model.testError ? (
        <p className="federationerror" role="alert">
          {model.testError}
        </p>
      ) : null}
    </ResourcePanel>
  );
}

function ProviderCard({ provider, model }: Readonly<{ provider: FederationProvider; model: FederationViewModel }>) {
  const health = model.health[provider.id];
  return (
    <article className="federationcard">
      <header>
        <span className={`federationicon is-${provider.type}`} aria-hidden="true">
          {symbol(provider.type)}
        </span>
        <div>
          <h2>{name(provider.type)}</h2>
          <p>{description(provider.type)}</p>
        </div>
        <strong>已启用</strong>
      </header>
      <dl>
        <div>
          <dt>适用账号</dt>
          <dd>{audience(provider.type)}</dd>
        </div>
        <div>
          <dt>密钥</dt>
          <dd>仅服务端引用，不回显</dd>
        </div>
        <div>
          <dt>最近检查</dt>
          <dd>{health ? healthLabel(health.status) : '本次会话尚未检查'}</dd>
        </div>
        <div>
          <dt>检查时间</dt>
          <dd>{health ? new Date(health.checkedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</dd>
        </div>
      </dl>
      {model.canTest ? (
        <footer>
          {model.assurance < 3 ? (
            <Button tone="primary" onPress={model.actions.stepup}>
              验证后健康检查
            </Button>
          ) : (
            <Button onPress={() => model.actions.test(provider.id)} isDisabled={model.testing !== undefined}>
              {model.testing === provider.id ? '正在连接服务商…' : '执行真实健康检查'}
            </Button>
          )}
        </footer>
      ) : null}
    </article>
  );
}

function name(type: FederationType): string {
  return { wechat: '微信开放平台', wecomcorp: '企业微信自建应用', wecomsuite: '企业微信第三方应用', oidc: 'OIDC 统一身份登录' }[type];
}
function symbol(type: FederationType): string {
  return { wechat: '微', wecomcorp: '企', wecomsuite: '套', oidc: 'ID' }[type];
}
function description(type: FederationType): string {
  return type === 'oidc' ? '通过标准授权码流程与企业身份源联通' : type === 'wechat' ? '面向微信用户的可信身份登录' : '面向企业成员的组织身份登录';
}
function audience(type: FederationType): string {
  return type === 'wechat' ? '微信消费者账号' : type === 'oidc' ? '企业统一身份账号' : '企业成员账号';
}
function healthLabel(status: FederationHealth['status']): string {
  return status === 'healthy' ? '连接健康' : status === 'degraded' ? '服务降级' : '当前不可用';
}
