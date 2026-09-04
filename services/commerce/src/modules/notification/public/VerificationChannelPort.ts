import { publicPort } from '../../../bootstrap/ModuleRegistry';

export type VerificationChannelId = 'qrcode' | 'sms' | 'app';

export interface VerificationChannelBinding {
  readonly id: VerificationChannelId;
  readonly delivery: 'inline' | 'notification';
  readonly provider: 'qrcode' | 'sms' | 'inapp';
}

export interface VerificationChannelPort {
  require(id: VerificationChannelId): VerificationChannelBinding;
}

export const VERIFICATION_CHANNEL_PORT = publicPort<VerificationChannelPort>('notification', 'verificationchannel');
