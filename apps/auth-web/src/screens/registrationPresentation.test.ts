import { describe, expect, it } from 'vitest';
import { registrationPresentation } from './registrationPresentation';

describe('invitation registration presentation', () => {
  it('describes an operator invitation as a zero-permission ordinary administrator account', () => {
    const presentation = registrationPresentation('console');

    expect(presentation.title).toBe('注册普通管理员');
    expect(presentation.submitLabel).toBe('创建普通管理员账号');
    expect(presentation.description).toContain('同时开通商城与运营后台');
    expect(presentation.description).toContain('0 业务权限');
    expect(presentation.successNotice).toContain('商城与后台身份已同时开通');
    expect(presentation.successNotice).toContain('等待 Owner 或高级管理员授权');
  });

  it('uses ordinary employee language only for a storefront invitation', () => {
    const pending = registrationPresentation();
    const storefront = registrationPresentation('storefront');

    expect(pending.title).not.toContain('普通员工');
    expect(storefront.title).toBe('注册普通员工');
    expect(storefront.footer).toContain('只开通消费商城');
    expect(storefront.footer).toContain('不开通运营后台');
  });

  it('shows the authoritative senior administrator scope after verification', () => {
    const presentation = registrationPresentation('console', 'senior_administrator');

    expect(presentation.title).toBe('注册高级管理员');
    expect(presentation.resolvedNotice).toContain('全部业务功能');
    expect(presentation.footer).toContain('不具备 Owner');
  });
});
