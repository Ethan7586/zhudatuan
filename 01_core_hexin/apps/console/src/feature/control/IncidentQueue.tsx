import type { ControlIncident } from './ControlSchema';

export function IncidentQueue({ incidents, selectedId, onSelect, onEvidence, onExecute }: Readonly<{
  incidents: readonly ControlIncident[];
  selectedId: string | undefined;
  onSelect: (incident: ControlIncident) => void;
  onEvidence: (incident: ControlIncident) => void;
  onExecute: (incident: ControlIncident) => void;
}>) {
  return (
    <section className="controlcard incidentqueue" aria-labelledby="incidenttitle">
      <header><h2 id="incidenttitle">优先处置</h2><p>按客户影响、范围与紧迫程度排序</p></header>
      {incidents.length === 0 ? <p className="controlempty">暂无权威处置队列</p> : incidents.map((incident, index) => {
        const expanded = incident.id === selectedId;
        return <article key={incident.id} data-priority={incident.priority} data-selected={expanded || undefined}>
          <button className="incidentselect" type="button" onClick={() => onSelect(incident)} aria-expanded={expanded}>
            <span className="prioritytag">{incident.priority === 'CHANGE' ? '变更' : incident.priority}</span>
            <strong>{incident.title}</strong>
            {index > 0 ? <span className="incidentlink">{incident.action}</span> : null}
          </button>
          <p>{incident.impact}</p>
          {expanded ? <IncidentDetail incident={incident} onEvidence={onEvidence} onExecute={onExecute} /> : null}
        </article>;
      })}
    </section>
  );
}

function IncidentDetail({ incident, onEvidence, onExecute }: Readonly<{
  incident: ControlIncident;
  onEvidence: (incident: ControlIncident) => void;
  onExecute: (incident: ControlIncident) => void;
}>) {
  return (
    <div className="incidentdetail">
      {incident.startedAt === undefined ? null : <span>{incident.startedAt} 开始{incident.retryCount === undefined ? '' : ` · 已自动重试 ${incident.retryCount} 次`}</span>}
      {incident.cause === undefined ? null : <span>可能原因：{incident.cause}</span>}
      {incident.owner === undefined ? null : <span>Owner：{incident.owner}{incident.slaMinutes === undefined ? '' : ` · 剩余 SLA ${incident.slaMinutes} 分钟`}</span>}
      <div className="incidentactions">
        <button type="button" onClick={() => onEvidence(incident)}>查看证据</button>
        <button type="button" className="primaryaction" onClick={() => onExecute(incident)}>{incident.action}</button>
      </div>
    </div>
  );
}
