import { ResourceState } from '@shop/design';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import { queryCondition, safeQueryError } from '../../shared/api/QueryState';
import { CapabilityChain } from './CapabilityChain';
import { ActiveChange, AuditTimeline } from './ControlChanges';
import { AuditDialog, ChangeDialog, EvidenceDialog, RecoveryDialog } from './ControlDialogs';
import { ControlHero } from './ControlHero';
import { controlKey, readControl } from './ControlQuery';
import type { ControlChange, ControlIncident } from './ControlSchema';
import { IncidentQueue } from './IncidentQueue';
import './control.css';

export function Component() {
  const context = useConsoleContext();
  const query = useQuery({
    queryKey: controlKey(context),
    queryFn: ({ signal }) => readControl(context, signal),
    refetchInterval: 30_000,
  });
  const error = safeQueryError(query.error);
  const condition = queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error,
    hasData: query.data !== undefined, empty: false, stale: query.isStale });
  return (
    <section className="controlpage" aria-label="智慧翼中控台">
      <ResourceState condition={condition} {...(error === undefined ? {} : { error })} retry={() => { void query.refetch(); }}>
        {query.data === undefined ? <span /> : <ControlContent data={query.data} refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} />}
      </ResourceState>
    </section>
  );
}

function ControlContent({ data, refreshing, onRefresh }: Readonly<{
  data: Awaited<ReturnType<typeof readControl>>;
  refreshing: boolean;
  onRefresh: () => void;
}>) {
  const plane = data.controlPlane;
  const [selectedId, setSelectedId] = useState<string>();
  const [evidence, setEvidence] = useState<ControlIncident>();
  const [recovery, setRecovery] = useState<ControlIncident>();
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [changeAction, setChangeAction] = useState<'plan' | 'pause' | 'rollback'>();
  const [change, setChange] = useState<ControlChange>();
  const [auditOpen, setAuditOpen] = useState(false);
  const selected = plane?.incidents.find((incident) => incident.id === selectedId) ?? plane?.incidents[0];
  const openChange = (action: 'plan' | 'pause' | 'rollback', item: ControlChange) => { setChange(item); setChangeAction(action); };
  const closeRecovery = () => { setRecovery(undefined); setRecoveryConfirmed(false); };
  return <div className="controlstack">
    <ControlHero plane={plane} refreshing={refreshing} onRefresh={onRefresh} />
    <div className="controlprimarygrid">
      <IncidentQueue incidents={plane?.incidents ?? []} selectedId={selected?.id} onSelect={(incident) => setSelectedId(incident.id)}
        onEvidence={setEvidence} onExecute={(incident) => { setRecoveryConfirmed(false); setRecovery(incident); }} />
      <CapabilityChain capabilities={plane?.capabilities ?? []} affected={selected?.affectedCapabilities ?? []} />
    </div>
    <div className="controlsecondarygrid">
      <ActiveChange change={plane?.changes[0]} onAction={openChange} />
      <AuditTimeline audits={plane?.audits ?? []} onOpen={() => setAuditOpen(true)} />
    </div>
    <EvidenceDialog incident={evidence} onClose={() => setEvidence(undefined)} />
    <RecoveryDialog incident={recovery} confirmed={recoveryConfirmed} onConfirm={() => setRecoveryConfirmed(true)} onClose={closeRecovery} />
    <ChangeDialog action={changeAction} change={change} onClose={() => { setChangeAction(undefined); setChange(undefined); }} />
    <AuditDialog open={auditOpen} audits={plane?.audits ?? []} onClose={() => setAuditOpen(false)} />
  </div>;
}
