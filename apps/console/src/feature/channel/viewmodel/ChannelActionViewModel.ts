import { presentError } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ChannelDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { requiredAssurance } from '../../../shared/security/OperationAccess';
import type { ConnectionDraft, SyncDraft, SyncKind } from '../model/Channel';
import type { ChannelAction } from '../model/ChannelAction';
import type { ChannelCommand } from '../model/ChannelCommand';
import { buildConnectionDraft, initialConnectionValues, type ConnectionValues } from '../model/ConnectionForm';
import { channelOperation, validateChannelAction } from './ChannelValidation';

export function useChannelActionViewModel(action: ChannelAction | null, context: ConsoleContext, dependencies: ChannelDependencies, requestStepup: () => void, done: (command: ChannelCommand) => void) {
  const providers = dependencies.registry.all();
  const [provider, setProvider] = useState(providers[0]?.id ?? '');
  const [configuration, setConfiguration] = useState<ConnectionValues>(() => (providers[0] ? initialConnectionValues(providers[0]) : Object.freeze({})));
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
  const initialProvider = action?.kind === 'update' ? action.connection.provider : (providers[0]?.id ?? '');
  useEffect(() => {
    setProvider(initialProvider);
    setConfiguration(initialProvider && dependencies.registry.has(initialProvider) ? actionValues(dependencies.registry.get(initialProvider), action) : Object.freeze({}));
    setSyncKind('catalog');
    setCursor('');
    setStart('');
    setEnd('');
    setTimezone('Asia/Shanghai');
    setPartner('');
    setProof('');
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
  }, [action, actionIdentity, dependencies, initialProvider]);
  const registration = providers.find((candidate) => candidate.id === provider);
  const draft = useMemo<ConnectionDraft>(() => (registration ? buildConnectionDraft(registration, configuration) : emptyDraft(provider)), [configuration, provider, registration]);
  const sync = useMemo<SyncDraft>(
    () =>
      Object.freeze({
        connection: action?.kind === 'startsync' ? action.connection.id : '',
        kind: syncKind,
        ...(cursor.trim() ? { cursor: cursor.trim() } : {}),
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
        ...(timezone.trim() ? { timezone: timezone.trim() } : {}),
        ...(partner.trim() ? { partner: partner.trim() } : {}),
      }),
    [action, cursor, end, partner, start, syncKind, timezone]
  );
  const command = useMemo(() => buildCommand(action, draft, sync, proof, identity), [action, draft, identity, proof, sync]);
  const validation = validateChannelAction(action, registration, draft, sync, proof, confirmed);
  const mutation = useMutation({ mutationFn: async (value: ChannelCommand) => execute(value, context, dependencies), onSuccess: (_, value) => done(value) });
  const reset =
    <T>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setConfirmed(false);
      setIdentity(dependencies.createIdentity());
    };
  const required = action ? requiredAssurance(channelOperation(action)) : 0;
  const submit = () => {
    if (!action || !command) return;
    if (context.session.assurance.level < required) {
      requestStepup();
      return;
    }
    if (validation) return;
    if (!mutation.isPending) mutation.mutate(command);
  };
  const chooseProvider = (value: string) => {
    setProvider(value);
    setConfiguration(dependencies.registry.has(value) ? initialConnectionValues(dependencies.registry.get(value)) : Object.freeze({}));
    setConfirmed(false);
    setIdentity(dependencies.createIdentity());
  };
  return Object.freeze({
    action,
    providers,
    registration,
    provider,
    configuration,
    syncKind,
    cursor,
    start,
    end,
    timezone,
    partner,
    proof,
    confirmed,
    validation,
    required,
    busy: mutation.isPending,
    error: mutation.error ? presentError(mutation.error).message : undefined,
    assurance: context.session.assurance.level,
    actions: Object.freeze({
      provider: chooseProvider,
      field: (key: string, value: string) => reset(setConfiguration)(Object.freeze({ ...configuration, [key]: value })),
      syncKind: reset(setSyncKind),
      cursor: reset(setCursor),
      start: reset(setStart),
      end: reset(setEnd),
      timezone: reset(setTimezone),
      partner: reset(setPartner),
      proof: reset(setProof),
      confirmed: setConfirmed,
      submit,
      retry: submit,
      stepup: requestStepup,
    }),
  });
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

function emptyDraft(provider: string): ConnectionDraft {
  return Object.freeze({ provider, region: '', healthOperation: '', endpoints: Object.freeze({}), secretRef: '' });
}

function actionValues(provider: ReturnType<ChannelDependencies['registry']['get']>, action: ChannelAction | null): ConnectionValues {
  const values = initialConnectionValues(provider);
  return action?.kind === 'update' ? Object.freeze({ ...values, region: action.connection.region }) : values;
}

function identify(action: ChannelAction | null): string {
  return !action
    ? 'closed'
    : action.kind === 'create' || action.kind === 'startsync'
      ? action.kind
      : action.kind === 'cancelsync'
        ? `${action.kind}:${action.sync.id}`
        : action.kind === 'replay'
          ? `${action.kind}:${action.operation.id}`
          : `${action.kind}:${action.connection.id}`;
}
async function execute(command: ChannelCommand, context: ConsoleContext, dependencies: ChannelDependencies) {
  if (command.kind === 'create') return dependencies.create.execute(context, command.draft, command.proof, command.identity);
  if (command.kind === 'update') return dependencies.update.execute(context, command.connection, command.version, command.draft, command.proof, command.identity);
  if (command.kind === 'test') return dependencies.test.execute(context, command.connection, command.version, command.proof, command.identity);
  if (command.kind === 'enable') return dependencies.enable.execute(context, command.connection, command.version, command.proof, command.identity);
  if (command.kind === 'disable') return dependencies.disable.execute(context, command.connection, command.version, command.proof, command.identity);
  if (command.kind === 'startsync') return dependencies.startSync.execute(context, command.draft, command.identity);
  if (command.kind === 'cancelsync') return dependencies.cancelSync.execute(context, command.sync, command.version, command.identity);
  return dependencies.replay.execute(context, command.operation, command.proof, command.identity);
}
