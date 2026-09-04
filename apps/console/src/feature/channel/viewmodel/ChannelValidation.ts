import type { ProviderUiCatalog } from '@shop/contract';
import { requiredAssurance } from '../../../shared/security/OperationAccess';
import { channelOperations, type ConnectionDraft, type SyncDraft } from '../model/Channel';
import type { ChannelAction } from '../model/ChannelAction';
import { validateConnectionDraft } from '../model/ConnectionForm';

export function validateChannelAction(action: ChannelAction | null, provider: ProviderUiCatalog | undefined, draft: ConnectionDraft, sync: SyncDraft, proof: string, confirmed: boolean): string | undefined {
  if (!action) return undefined;
  if (!confirmed) return '请先核对影响并确认执行。';
  if (requiredAssurance(channelOperation(action)) === 3 && !/^[A-Za-z0-9_-]{43,128}$/.test(proof)) return '请输入有效的一次性复核凭证。';
  if (action.kind === 'create' || action.kind === 'update') {
    if (!provider || provider.id !== draft.provider) return '所选扩展的配置定义不可用，请刷新后重试。';
    const invalid = validateConnectionDraft(provider, draft, action.kind === 'update');
    if (invalid) return invalid;
  }
  if (action.kind === 'startsync') {
    if (!sync.connection) return '请选择渠道连接。';
    if (sync.kind === 'statement' && (!sync.start || !sync.end || !sync.timezone || !sync.partner)) return '账单同步必须填写起止日期、时区和合作方。';
  }
  return undefined;
}

export function channelOperation(action: ChannelAction) {
  return action.kind === 'create'
    ? channelOperations.create
    : action.kind === 'update'
      ? channelOperations.update
      : action.kind === 'test'
        ? channelOperations.test
        : action.kind === 'enable'
          ? channelOperations.enable
          : action.kind === 'disable'
            ? channelOperations.disable
            : action.kind === 'startsync'
              ? channelOperations.startSync
              : action.kind === 'cancelsync'
                ? channelOperations.cancelSync
                : channelOperations.replay;
}
