import { describe, expect, it } from 'vitest';
import { CLIENT_PLATFORM, REQUIRED_DELIVERY_PLATFORMS, RESERVED_DELIVERY_PLATFORMS } from './platform';

describe('multi-platform delivery contract', () => {
  it('keeps the current delivery pair explicit', () => {
    expect(REQUIRED_DELIVERY_PLATFORMS).toEqual([CLIENT_PLATFORM.web, CLIENT_PLATFORM.wechatMiniapp]);
  });

  it('reserves every approved native client', () => {
    expect(RESERVED_DELIVERY_PLATFORMS).toEqual([CLIENT_PLATFORM.harmonyos, CLIENT_PLATFORM.ios, CLIENT_PLATFORM.android]);
  });
});
