import { HonestNotice, MetricGrid, StatusPill } from './EngineeringFrame';

const targets = [
  ['Storefront', 'L1', '商城运行入口'],
  ['Console', 'L1', '经营与权限管理后台'],
  ['Identity', 'L1', '身份与会话服务'],
  ['Commerce', 'L1', '商城公共业务服务'],
  ['Workers', 'L1', '异步任务与后台作业'],
] as const;

export function RuntimeStatusContent() {
  return <>
    <MetricGrid metrics={[
      { label: '实时数据', value: '待接入', detail: '尚未连接集中遥测', tone: 'waiting' },
      { label: '观察范围', value: 'L0 / L1 / L2', detail: '节点、服务与业务入口' },
      { label: '运行目标', value: '15 类', detail: '以交付清单为准' },
      { label: '数据权限', value: '只读', detail: '不控制生产运行', tone: 'ready' },
    ]} />
    <HonestNotice title="实时运行数据尚未接入">
      当前页面先固定观察模型与展示边界；在健康、延迟、错误率和版本数据接入前，不显示“运行正常”等推断性结论。
    </HonestNotice>
    <div className="engineeringtwocolumn engineeringstatuslayout">
      <article className="engineeringpanel">
        <header><div><span>RUNTIME TOPOLOGY</span><h2>服务拓扑</h2></div><StatusPill tone="waiting">等待数据源</StatusPill></header>
        <div className="engineeringtopology">
          <section><b>L0</b><h3>核心基础设施</h3><span>计算</span><span>存储</span><span>网络</span></section>
          <i aria-hidden="true">→</i>
          <section><b>L1</b><h3>公共平台与运行服务</h3><span>Storefront</span><span>Console</span><span>Identity · Commerce · Workers</span></section>
          <i aria-hidden="true">→</i>
          <section><b>L2</b><h3>商城与业务入口</h3><span>商城业务</span><span>H6 体验入口</span><span>渠道与边缘路由</span></section>
        </div>
      </article>
      <article className="engineeringpanel engineeringtelemetry">
        <header><div><span>CORE METRICS</span><h2>核心指标</h2></div><small>接入后自动刷新</small></header>
        {['响应时间', '错误率', '请求量'].map((label) => <div key={label}>
          <span>{label}</span><div className="engineeringmetricempty"><i /></div><strong>暂无数据</strong>
        </div>)}
      </article>
    </div>
    <article className="engineeringpanel engineeringtablepanel">
      <header><div><span>RUNTIME TARGETS</span><h2>运行目标状态</h2></div></header>
      <div className="engineeringtablewrap"><table><thead><tr><th>目标</th><th>层级</th><th>职责</th><th>状态</th><th>响应时间</th><th>当前版本</th></tr></thead>
        <tbody>{targets.map(([name, layer, duty]) => <tr key={name}><td><strong>{name}</strong></td><td>{layer}</td><td>{duty}</td>
          <td><StatusPill tone="waiting">待接入</StatusPill></td><td>—</td><td>—</td></tr>)}</tbody></table></div>
    </article>
  </>;
}
