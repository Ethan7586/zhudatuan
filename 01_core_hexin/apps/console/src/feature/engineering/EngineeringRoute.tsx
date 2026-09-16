import { HonestNotice, MetricGrid, StatusPill } from './EngineeringFrame';

const layers = [
  { id: 'L0', title: '核心基础设施', items: ['计算与存储', '网络与安全', '云平台基础组件'] },
  { id: 'L1', title: '公共平台与运行服务', items: ['Storefront / Console', 'Identity / Commerce', 'Workers 与共享能力'] },
  { id: 'L2', title: '商城与业务入口', items: ['商城业务体验', 'H6 体验入口', '渠道与边缘路由'] },
] as const;

const technologies = [
  ['前端与交互', 'React 19 · React Router 8 · TanStack Query 5'],
  ['类型与契约', 'TypeScript 5.9 · Zod 4 · 分层契约目录'],
  ['构建与验证', 'Vite 8 · Vitest 4 · Node.js 22.22.0'],
  ['数据与运行', 'PostgreSQL 17 · Node.js Runtime · Caddy'],
  ['边缘与交付', 'GitHub Actions · 阿里云 OSS / ECS · Cloudflare DNS'],
] as const;

const memberKernelSlices = [
  { name: '会员目录', sourceSha: null, deployedSha: null, verifiedSha: null, detail: '仍由原 Member 模块读取' },
  { name: '会员基础档案读取', sourceSha: null, deployedSha: null, verifiedSha: null, detail: '仍由原 Member 模块读取' },
  { name: '自定义档案字段校验', sourceSha: '4562a7a15818178de874764dbd51bb1666241b50',
    deployedSha: null, verifiedSha: null, detail: '本地已调用 L-kernel；线上未验收' },
] as const;

function kernelState(slice: (typeof memberKernelSlices)[number]): 'legacy' | 'pending' | 'verified' {
  if (slice.sourceSha === null) return 'legacy';
  return slice.deployedSha !== null && slice.deployedSha === slice.verifiedSha ? 'verified' : 'pending';
}

const kernelStateLabel = { legacy: '未接入', pending: '未部署／待验证', verified: '线上已验证' } as const;

export function EngineeringOverviewContent() {
  return <>
    <MetricGrid metrics={[
      { label: '架构层级', value: 'L0 / L1 / L2', detail: '三层职责与依赖边界' },
      { label: '部署基础设施', value: '1.3 正式版', detail: '预构建不可变制品', tone: 'ready' },
      { label: '运行目标', value: '15 类', detail: 'L0 / L1 公共运行目标' },
      { label: '工程保障体系', value: 'ERA 2.0', detail: '12/12 MET · DEV VERIFIED', tone: 'ready' },
    ]} />

    <HonestNotice title="ERA 2.0 · Engineering Readiness & Assurance">
      当前证据评级为 12/12 MET · DEV VERIFIED · NOT REVIEWED；本区域只读展示，不代表生产观测或外部认证，不参与发布与部署门禁。
    </HonestNotice>

    <div className="engineeringtwocolumn">
      <article className="engineeringpanel engineeringarchitecture">
        <header><div><span>ARCHITECTURE</span><h2>系统架构关系</h2></div><StatusPill tone="information">职责已分层</StatusPill></header>
        <div className="engineeringlayers">
          {layers.map((layer, index) => <div className="engineeringlayerwrap" key={layer.id}>
            <section className="engineeringlayer" data-layer={layer.id}>
              <span>{layer.id}</span><h3>{layer.title}</h3>
              <ul>{layer.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            {index < layers.length - 1 ? <span className="engineeringarrow" aria-hidden="true">→</span> : null}
          </div>)}
        </div>
        <div className="engineeringreadonly"><strong>工程治理与技术资产（只读）</strong>
          <span>横向说明 L0 / L1 / L2，不控制业务、不写生产数据库、不成为部署门禁。</span></div>
      </article>

      <article className="engineeringpanel engineeringdelivery">
        <header><div><span>DELIVERY INFRASTRUCTURE</span><h2>部署基础设施 1.3</h2></div><StatusPill tone="ready">正式可用</StatusPill></header>
        <div className="engineeringdeliveryflow">
          <div><strong>GitHub 制品</strong><span>精确提交构建</span></div><b>→</b>
          <div><strong>阿里云 OSS</strong><span>不可变制品</span></div><b>→</b>
          <div><strong>ECS 原子切换</strong><span>健康检查与回滚</span></div>
        </div>
        <dl className="engineeringfacts">
          <div><dt>正式基准</dt><dd><code>b58fa3ad</code></dd></div>
          <div><dt>已验证目标</dt><dd>Storefront · Console</dd></div>
          <div><dt>迁移策略</dt><dd>随真实发布自然迁移</dd></div>
          <div><dt>旧通道</dt><dd>1.2 保留兜底</dd></div>
        </dl>
      </article>
    </div>

    <article className="engineeringpanel engineeringkernel">
      <header><div><span>L-KERNEL · L1</span><h2>会员内核继承状态</h2></div><small>按切片展示 · 只读证据快照</small></header>
      <div className="engineeringkernelgrid">
        {memberKernelSlices.map((slice) => {
          const state = kernelState(slice);
          return <section key={slice.name} className="engineeringkernelslice" data-state={state}>
            <span className="engineeringkernelstate">{kernelStateLabel[state]}</span>
            <strong>{slice.name}</strong><small>{slice.detail}</small>
          </section>;
        })}
      </div>
      <p className="engineeringkernelcaption">暗色＝未接入 · 灰色＝本地已接入但未部署或未验收 · 点亮＝同一切片的线上代码和真实 L1 验收均有证据。状态不参与业务或发布判断。</p>
    </article>

    <article className="engineeringpanel engineeringstack">
      <header><div><span>TECHNOLOGY STACK</span><h2>商城技术栈</h2></div><small>版本来自当前仓库与交付基线</small></header>
      <div className="engineeringstackgrid">
        {technologies.map(([title, detail]) => <div key={title}><strong>{title}</strong><span>{detail}</span></div>)}
      </div>
    </article>
  </>;
}
