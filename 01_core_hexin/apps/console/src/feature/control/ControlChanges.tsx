import type { ControlAudit, ControlChange } from './ControlSchema';

export function ActiveChange({ change, onAction }: Readonly<{
  change: ControlChange | undefined;
  onAction: (action: 'plan' | 'pause' | 'rollback', change: ControlChange) => void;
}>) {
  return (
    <section className="controlcard activechange" aria-labelledby="changetitle">
      <h2 id="changetitle">正在进行的变更</h2>
      {change === undefined ? <p className="controlempty">当前没有服务端变更记录</p> : <>
        <strong>{change.title}</strong>
        <span>目标：{change.target}</span>
        <span>停止条件：{change.stopCondition}</span>
        <span>回滚预计：{change.rollbackEstimate}</span>
        <div><button type="button" onClick={() => onAction('plan', change)}>查看计划</button>
          <button type="button" onClick={() => onAction('pause', change)}>暂停</button>
          <button type="button" className="dangeraction" onClick={() => onAction('rollback', change)}>回滚</button></div>
      </>}
    </section>
  );
}

export function AuditTimeline({ audits, onOpen }: Readonly<{
  audits: readonly ControlAudit[];
  onOpen: () => void;
}>) {
  return (
    <section className="controlcard audittimeline" aria-labelledby="audittitle">
      <h2 id="audittitle">最近变更与验证</h2>
      {audits.length === 0 ? <p className="controlempty">暂无权威审计记录</p> : <ol>{audits.map((audit) => <li key={audit.id} data-status={audit.status}>
        <time>{audit.time}</time><i aria-hidden="true" /><span>{audit.title}</span><small>{audit.detail}</small>
      </li>)}</ol>}
      <button className="auditlink" type="button" onClick={onOpen}>查看完整审计记录 →</button>
    </section>
  );
}
