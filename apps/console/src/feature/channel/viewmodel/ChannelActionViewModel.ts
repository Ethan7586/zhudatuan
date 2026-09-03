import { presentError } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ChannelDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { requiredAssurance } from '../../../shared/security/OperationAccess';
import { channelOperations, channelProviders, type ConnectionDraft, type SyncDraft, type SyncKind } from '../model/Channel';
import type { ChannelAction } from '../model/ChannelAction';
import type { ChannelCommand } from '../model/ChannelCommand';

export function useChannelActionViewModel(action: ChannelAction | null, context: ConsoleContext, dependencies: ChannelDependencies, requestStepup: () => void, done: (command: ChannelCommand) => void) {
  const [provider, setProvider] = useState(channelProviders[0]?.id ?? '');
  const [region, setRegion] = useState('cn');
  const [baseUrl, setBaseUrl] = useState('');
  const [healthOperation, setHealthOperation] = useState('health');
  const [endpoints, setEndpoints] = useState('{\n  "health": "/health"\n}');
  const [secretRef, setSecretRef] = useState('');
  const [connection, setConnection] = useState('');
  const [syncKind, setSyncKind] = useState<SyncKind>('catalog');
  const [cursor, setCursor] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [timezone, setTimezone] = useState('Asia/Shanghai');
  const [partner, setPartner] = useState('');
  const [proof, setProof] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const actionIdentity = identify(action);
  useEffect(() => {
    setProvider(action?.kind === 'update' ? action.connection.provider : channelProviders[0]?.id ?? ''); setRegion(action?.kind === 'update' ? action.connection.region : 'cn'); setBaseUrl(''); setHealthOperation(action?.kind === 'update' && action.connection.provider === 'supplier' ? 'local' : 'health'); setEndpoints('{\n  "health": "/health"\n}'); setSecretRef(''); setConnection(action?.kind === 'startsync' ? action.connection?.id ?? '' : ''); setSyncKind('catalog'); setCursor(''); setStart(''); setEnd(''); setTimezone('Asia/Shanghai'); setPartner(''); setProof(''); setConfirmed(false); setIdentity(dependencies.createIdentity());
  }, [actionIdentity, dependencies]);
  const endpointResult = useMemo(() => parseEndpoints(endpoints), [endpoints]);
  const draft = useMemo<ConnectionDraft>(() => Object.freeze({ provider, region: region.trim(), ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}), healthOperation: healthOperation.trim(), endpoints: endpointResult.value, secretRef: secretRef.trim() }), [baseUrl, endpointResult.value, healthOperation, provider, region, secretRef]);
  const sync = useMemo<SyncDraft>(() => Object.freeze({ connection: connection.trim(), kind: syncKind, ...(cursor.trim() ? { cursor: cursor.trim() } : {}), ...(start ? { start } : {}), ...(end ? { end } : {}), ...(timezone.trim() ? { timezone: timezone.trim() } : {}), ...(partner.trim() ? { partner: partner.trim() } : {}) }), [connection, cursor, end, partner, start, syncKind, timezone]);
  const command = useMemo(() => buildCommand(action, draft, sync, proof, identity), [action, draft, identity, proof, sync]);
  const validation = validate(action, draft, sync, endpointResult.error, proof, confirmed);
  const mutation = useMutation({ mutationFn: async (value: ChannelCommand) => execute(value, context, dependencies), onSuccess: (_, value) => done(value) });
  const reset = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setConfirmed(false); setIdentity(dependencies.createIdentity()); };
  const required = action ? requiredAssurance(operation(action)) : 0;
  const submit = () => {
    if (!action || !command) return;
    if (context.session.assurance.level < required) { requestStepup(); return; }
    if (validation) return;
    if (!mutation.isPending) mutation.mutate(command);
  };
  const chooseProvider = (value: string) => { setProvider(value); setHealthOperation(value === 'supplier' ? 'local' : 'health'); setBaseUrl(''); setEndpoints(value === 'supplier' ? '{}' : '{\n  "health": "/health"\n}'); setSecretRef(''); setConfirmed(false); setIdentity(dependencies.createIdentity()); };
  return Object.freeze({ action, provider, region, baseUrl, healthOperation, endpoints, secretRef, connection, syncKind, cursor, start, end, timezone, partner, proof, confirmed, validation, required, busy: mutation.isPending, error: mutation.error ? presentError(mutation.error).message : undefined, assurance: context.session.assurance.level, actions: Object.freeze({ provider: chooseProvider, region: reset(setRegion), baseUrl: reset(setBaseUrl), healthOperation: reset(setHealthOperation), endpoints: reset(setEndpoints), secretRef: reset(setSecretRef), connection: reset(setConnection), syncKind: reset(setSyncKind), cursor: reset(setCursor), start: reset(setStart), end: reset(setEnd), timezone: reset(setTimezone), partner: reset(setPartner), proof: reset(setProof), confirmed: setConfirmed, submit, retry: submit, stepup: requestStepup }) });
}

export type ChannelActionViewModel = ReturnType<typeof useChannelActionViewModel>;

function buildCommand(action: ChannelAction | null, draft: ConnectionDraft, sync: SyncDraft, proof: string, identity: string): ChannelCommand | null {
  if (!action) return null;
  if (action.kind === 'create') return { kind: action.kind, draft, proof, identity };
  if (action.kind === 'update') return { kind: action.kind, connection: action.connection.id, version: action.connection.version, draft, proof, identity };
  if (action.kind === 'test' || action.kind === 'enable' || action.kind === 'disable') return { kind: action.kind, connection: action.connection.id, version: action.connection.version, proof, identity };
  if (action.kind === 'startsync') return { kind: action.kind, draft: sync, identity };
  if (action.kind === 'cancelsync') return { kind: action.kind, sync: action.sync.id, version: action.sync.version, identity };
  return { kind: action.kind, operation: action.operation.id, proof, identity };
}

function validate(action: ChannelAction | null, draft: ConnectionDraft, sync: SyncDraft, endpointError: string | undefined, proof: string, confirmed: boolean): string | undefined {
  if (!action) return undefined;
  if (!confirmed) return '请先核对影响并确认执行。';
  if (operation(action) && requiredAssurance(operation(action)) === 3 && !/^[A-Za-z0-9_-]{43,4096}$/.test(proof)) return '请输入有效的一次性复核凭证。';
  if (action.kind === 'create' || action.kind === 'update') {
    if (!draft.provider || !draft.region || !draft.healthOperation) return '服务商、区域和健康检查操作不能为空。';
    if (endpointError) return endpointError;
    if (draft.provider !== 'supplier' && (!draft.baseUrl?.startsWith('https://') || !draft.secretRef || !draft.endpoints[draft.healthOperation]?.startsWith('/'))) return '远程渠道必须填写 HTTPS 服务地址、密钥引用及健康检查路径。';
    if (draft.provider === 'supplier' && (draft.baseUrl || draft.secretRef || Object.keys(draft.endpoints).length > 0 || draft.healthOperation !== 'local')) return '自有供应商必须使用本地配置，不填写地址、端点或密钥引用。';
  }
  if (action.kind === 'startsync') {
    if (!sync.connection) return '请选择渠道连接。';
    if (sync.kind === 'statement' && (!sync.start || !sync.end || !sync.timezone || !sync.partner)) return '账单同步必须填写起止日期、时区和合作方。';
  }
  return undefined;
}

function parseEndpoints(value: string): Readonly<{ value: Readonly<Record<string, string>>; error?: string }> {
  try { const parsed: unknown = JSON.parse(value); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every((item) => typeof item === 'string' && item.startsWith('/'))) throw new Error(); return { value: Object.freeze({ ...(parsed as Record<string, string>) }) }; } catch { return { value: Object.freeze({}), error: '端点必须是由操作名和“/”开头路径组成的 JSON 对象。' }; }
}

function operation(action: ChannelAction) { return action.kind === 'create' ? channelOperations.create : action.kind === 'update' ? channelOperations.update : action.kind === 'test' ? channelOperations.test : action.kind === 'enable' ? channelOperations.enable : action.kind === 'disable' ? channelOperations.disable : action.kind === 'startsync' ? channelOperations.startSync : action.kind === 'cancelsync' ? channelOperations.cancelSync : channelOperations.replay; }
function identify(action: ChannelAction | null): string { return !action ? 'closed' : action.kind === 'create' || action.kind === 'startsync' ? action.kind : action.kind === 'cancelsync' ? `${action.kind}:${action.sync.id}` : action.kind === 'replay' ? `${action.kind}:${action.operation.id}` : `${action.kind}:${action.connection.id}`; }
async function execute(command: ChannelCommand, context: ConsoleContext, dependencies: ChannelDependencies) { if (command.kind === 'create') return dependencies.create.execute(context, command.draft, command.proof, command.identity); if (command.kind === 'update') return dependencies.update.execute(context, command.connection, command.version, command.draft, command.proof, command.identity); if (command.kind === 'test') return dependencies.test.execute(context, command.connection, command.version, command.proof, command.identity); if (command.kind === 'enable') return dependencies.enable.execute(context, command.connection, command.version, command.proof, command.identity); if (command.kind === 'disable') return dependencies.disable.execute(context, command.connection, command.version, command.proof, command.identity); if (command.kind === 'startsync') return dependencies.startSync.execute(context, command.draft, command.identity); if (command.kind === 'cancelsync') return dependencies.cancelSync.execute(context, command.sync, command.version, command.identity); return dependencies.replay.execute(context, command.operation, command.proof, command.identity); }
