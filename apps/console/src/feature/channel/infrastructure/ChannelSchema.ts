import { operationSchema } from '@shop/contract';
import {
  OP_CHANNEL_CONNECTIONS_READ,
  OP_CHANNEL_OPERATIONS_READ,
  OP_CHANNEL_SYNCRUNS_READ,
} from '@shop/contract/ids';

export const ChannelConnectionPageSchema = operationSchema(OP_CHANNEL_CONNECTIONS_READ).output;
export const ChannelSyncPageSchema = operationSchema(OP_CHANNEL_SYNCRUNS_READ).output;
export const ChannelOperationPageSchema = operationSchema(OP_CHANNEL_OPERATIONS_READ).output;
