import { defineSelectedModule } from '../../bootstrap/DefinedModule';
import { CHANNEL_OPERATOR_READ_OPERATION_IDS, channelOperatorReadOperations } from './ChannelReadOperations';

export const IdentityOperatorChannelModule = defineSelectedModule(
  'channel', CHANNEL_OPERATOR_READ_OPERATION_IDS, channelOperatorReadOperations, ['identity'],
);
