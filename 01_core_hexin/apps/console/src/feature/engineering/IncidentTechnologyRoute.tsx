import { HonestNotice, MetricGrid, StatusPill } from './EngineeringFrame';

const runbooks = [
  ['登录异常排查', '身份入口、会话与回跳路径'],
  ['服务回滚流程', '版本指针、健康检查与回滚点'],
  ['数据库恢复', '逻辑备份、角色关系与恢复验证'],
  ['网络线路切换', 'DNS、CDN、源站与回退路径'],
] as const;

export function IncidentTechnologyContent() {
  return <>
    <MetricGrid metrics={[
      { label: '实时故障源', value: '待接入', detail: '不推断当前故障数量', tone: 'waiting' },
      { label: '技术问题源', value: '待接入', detail: '等待统一问题台账', tone: 'waiting' },
      { label: '处置手册', value: '4 类', detail: '首批恢复路径已定义' },
      { label: '治理原则', value: '事实优先', detail: '证据、恢复与复盘', tone: 'ready' },
    ]} />
    <HonestNotice title="故障数据尚未接入">
      当前只提供故障模型和处置知识入口；在告警、事件和工单数据源接通前，不显示“当前无故障”等未经证明的状态。
    </HonestNotice>
    <div className="engineeringtwocolumn engineeringincidentlayout">
      <article className="engineeringpanel engineeringincidentempty">
        <header><div><span>INCIDENT QUEUE</span><h2>故障与问题队列</h2></div><StatusPill tone="waiting">等待数据源</StatusPill></header>
        <div><span aria-hidden="true">◇</span><strong>暂无可核验的故障记录</strong>
          <p>接入真实监控与问题台账后，按级别、影响范围、负责人和恢复状态统一展示。</p></div>
      </article>
      <article className="engineeringpanel engineeringrunbooks">
        <header><div><span>RUNBOOKS</span><h2>技术处置手册</h2></div><StatusPill tone="information">只读</StatusPill></header>
        <div>{runbooks.map(([title, detail]) => <article key={title}><span>↗</span><strong>{title}</strong><small>{detail}</small></article>)}</div>
      </article>
    </div>
    <article className="engineeringpanel engineeringtimeline">
      <header><div><span>RECOVERY MODEL</span><h2>标准故障时间线</h2></div></header>
      <ol>
        <li><b>01</b><strong>发现</strong><span>记录原始告警与影响</span></li>
        <li><b>02</b><strong>遏制</strong><span>停止扩散并保留现场</span></li>
        <li><b>03</b><strong>恢复</strong><span>恢复服务并核对指标</span></li>
        <li><b>04</b><strong>复盘</strong><span>记录原因与长期改进</span></li>
      </ol>
    </article>
  </>;
}
