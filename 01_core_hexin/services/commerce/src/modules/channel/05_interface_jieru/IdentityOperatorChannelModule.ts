import { defineSelectedModule } from '../../../bootstrap/DefinedModule';
import { CHANNEL_OPERATOR_READ_OPERATION_IDS, channelOperatorReadOperations } from '../03_application_yingyong/ChannelReadOperations';

export const IdentityOperatorChannelModule = defineSelectedModule(
  'channel', CHANNEL_OPERATOR_READ_OPERATION_IDS, channelOperatorReadOperations, ['identity'],
);
