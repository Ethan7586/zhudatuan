import { describe, expect, it } from 'vitest';
import { chineseDomainLabel, chineseDomainList, chineseReference, chineseSectionLabel } from './ChineseDomain';
import { chineseProviderLabel } from './ChineseProvider';

describe('Chinese domain presentation', () => {
  it('presents shared states and provider catalog values in Chinese', () => {
    expect(chineseDomainLabel('active')).toBe('生效中');
    expect(chineseDomainLabel('partially_refunded')).toBe('部分退款');
    expect(chineseProviderLabel('jdproduct')).toBe('京东');
    expect(chineseDomainList(['welfare', 'meal'])).toBe('福利账户、餐补账户');
    expect(chineseDomainLabel('Self Service')).toBe('自助服务');
  });

  it('does not leak an unknown server enum into novice-facing copy', () => {
    expect(chineseDomainLabel('future_server_state')).toBe('待识别');
    expect(chineseProviderLabel('future_provider')).toBe('其他服务商');
  });

  it('turns technical identifiers into stable Chinese references', () => {
    const first = chineseReference('成员', 'membership-platform-owner-ethan-v1');
    expect(first).toMatch(/^成员 \d{4} \d{4}$/);
    expect(chineseReference('成员', 'membership-platform-owner-ethan-v1')).toBe(first);
    expect(chineseReference('成员', null)).toBe('—');
    expect(chineseSectionLabel('权限中心')).toBe('智慧翼 · 权限中心');
  });
});
