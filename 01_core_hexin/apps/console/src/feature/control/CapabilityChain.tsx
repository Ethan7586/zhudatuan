import type { ControlCapability } from './ControlSchema';

const statusLabels = Object.freeze({ stable: '稳定', attention: '需关注', action: '需处置', changing: '变更中', denied: '权限受限', unknown: '状态未知' });

export function CapabilityChain({ capabilities, affected }: Readonly<{
  capabilities: readonly ControlCapability[];
  affected: readonly string[];
}>) {
  const core = capabilities.filter((item) => item.group === 'core');
  const side = capabilities.filter((item) => item.group === 'side');
  return (
    <section className="controlcard capabilitychain" aria-labelledby="capabilitytitle">
      <header><h2 id="capabilitytitle">平台能力链</h2><p>当前任务影响链路</p></header>
      {capabilities.length === 0 ? <p className="controlempty">能力拓扑等待读模型返回</p> : <div className="capabilitylayout">
        <div className="corecapabilities">{core.map((capability, index) => <div key={capability.id}>
          <CapabilityNode capability={capability} affected={affected.includes(capability.id)} />
          {index === core.length - 1 ? null : <span className="chainarrow" aria-hidden="true">↓</span>}
        </div>)}</div>
        <div className="sidecapabilities">{side.map((capability) => <CapabilityNode key={capability.id} capability={capability} affected={affected.includes(capability.id)} />)}</div>
      </div>}
    </section>
  );
}

function CapabilityNode({ capability, affected }: Readonly<{ capability: ControlCapability; affected: boolean }>) {
  return <article className="capabilitynode" data-status={capability.status} data-affected={affected || undefined}>
    <span>{capability.title}</span><strong>{statusLabels[capability.status]}</strong>
  </article>;
}
