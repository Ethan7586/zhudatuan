import { token } from '../../../../bootstrap/Container';
import type { WechatScene } from '@shop/config/server';

export interface WechatIdentityResult {
  readonly subject: string;
  readonly union?: string;
}

export interface WechatJsSdkConfiguration {
  readonly appId: string;
  readonly timestamp: number;
  readonly nonceStr: string;
  readonly signature: string;
  readonly jsApiList: readonly ['openAddress'];
}

export interface WechatIdentity {
  application(scene: WechatScene): Readonly<{ applicationHash: string }>;
  authorize(scene: 'jsapi', state: string): string;
  exchange(scene: WechatScene, code: string): Promise<WechatIdentityResult>;
  jsSdkConfiguration(url: string): Promise<WechatJsSdkConfiguration>;
}

export const WECHAT_IDENTITY = token<WechatIdentity>('identity.wechat');
