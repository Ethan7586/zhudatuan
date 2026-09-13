import { EngineeringFrame, HonestNotice, MetricGrid, StatusPill } from './EngineeringFrame';

export function Component() {
  return <EngineeringFrame eyebrow="SYSTEM GOVERNANCE · RELEASES"
    title="发布与版本" description="管理不可变制品、生产版本、回滚点与自然迁移进度">
    <MetricGrid metrics={[
      { label: '部署基础设施', value: '1.3 正式版', detail: '当前正式交付通道', tone: 'ready' },
      { label: '已登记验证', value: '2 类目标', detail: 'Storefront · Console' },
      { label: '迁移方式', value: '自然迁移', detail: '随下一次真实发布推进' },
      { label: '回退通道', value: '1.2', detail: '继续承担兜底职责', tone: 'waiting' },
    ]} />
    <HonestNotice title="这是只读版本中心">
      页面记录通道和版本事实；真正的“部署”仍由独立工作流只切换已准备制品，本页不构建、不测试、不安装依赖。
    </HonestNotice>
    <div className="engineeringtwocolumn engineeringreleaselayout">
      <article className="engineeringpanel engineeringdelivery">
        <header><div><span>DELIVERY 1.3</span><h2>不可变制品交付链</h2></div><StatusPill tone="ready">正式可用</StatusPill></header>
        <div className="engineeringdeliveryflow">
          <div><strong>GitHub 制品</strong><span>构建与摘要</span></div><b>→</b>
          <div><strong>阿里云 OSS</strong><span>内容寻址存储</span></div><b>→</b>
          <div><strong>ECS 原子切换</strong><span>秒级生产窗口</span></div>
        </div>
        <div className="engineeringpurity"><strong>部署纯洁性</strong><span>只切换已准备的精确制品</span></div>
      </article>
      <article className="engineeringpanel">
        <header><div><span>FORMAL BASELINE</span><h2>1.3 正式基线</h2></div></header>
        <dl className="engineeringfacts engineeringfactslarge">
          <div><dt>基准提交</dt><dd><code>b58fa3ad</code></dd></div>
          <div><dt>正式状态</dt><dd><StatusPill tone="ready">已成立并可用</StatusPill></dd></div>
          <div><dt>验证目标</dt><dd>hbbtzn-l1 / Storefront · Console</dd></div>
          <div><dt>L2 边缘</dt><dd>H6 / h6-cdn 独立管理</dd></div>
        </dl>
      </article>
    </div>
    <article className="engineeringpanel engineeringmigration">
      <header><div><span>MIGRATION</span><h2>自然迁移策略</h2></div><StatusPill tone="information">进行中</StatusPill></header>
      <div className="engineeringmigrationbar"><i /><span>不为覆盖率进行无意义生产部署</span></div>
      <div className="engineeringmigrationfacts">
        <div><strong>Storefront</strong><StatusPill tone="ready">1.3 已验证</StatusPill></div>
        <div><strong>Console</strong><StatusPill tone="ready">1.3 已验证</StatusPill></div>
        <div><strong>其他 L0 / L1 目标</strong><StatusPill tone="waiting">随真实发布迁移</StatusPill></div>
        <div><strong>1.2</strong><StatusPill tone="information">保留兜底</StatusPill></div>
      </div>
    </article>
  </EngineeringFrame>;
}
