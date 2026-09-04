import { chineseDomainLabel } from '@shop/presentation';
import type { ChannelConnection } from '../model/Channel';
import { channelHealthDetail, channelHealthFailed } from './ChannelPresentation';

export function ConnectionHealth({ health }: Readonly<{ health: ChannelConnection['health'] }>) {
  const failed = channelHealthFailed(health);
  return <>
    {health.state ? chineseDomainLabel(health.state) : '尚未检查'}
    <small className={failed ? 'channelhealthfailure' : undefined} role={failed ? 'alert' : undefined}>{channelHealthDetail(health)}</small>
  </>;
}
