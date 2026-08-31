import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MembershipPage } from './MembershipPage';
import { MembershipSelection } from '../selection/MembershipSelection';

describe('membership selection states', () => {
  it('renders a bounded loading state while the one-time selection is checked', () => {
    const html = renderToStaticMarkup(
      <MembershipPage busy error="" hasSelection={false}>
        <span>hidden</span>
      </MembershipPage>
    );
    expect(html).toContain('正在核验身份');
    expect(html).toContain('role="status"');
  });

  it('renders the single eligible workspace without changing the existing UX', () => {
    const html = renderToStaticMarkup(
      <MembershipPage busy={false} error="" hasSelection>
        <MembershipSelection memberships={[{ id: 'membership:one', target: 'storefront' }]} busy={false} onSelect={() => undefined} />
      </MembershipPage>
    );
    expect(html).toContain('筑大团福利商城');
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it('renders each eligible target for a multi-membership selection', () => {
    const html = renderToStaticMarkup(
      <MembershipPage busy={false} error="" hasSelection>
        <MembershipSelection
          memberships={[
            { id: 'membership:one', target: 'storefront' },
            { id: 'membership:two', target: 'console' },
          ]}
          busy={false}
          onSelect={() => undefined}
        />
      </MembershipPage>
    );
    expect(html).toContain('筑大团福利商城');
    expect(html).toContain('筑大团运营后台');
    expect(html.match(/<button/g)).toHaveLength(2);
  });

  it('shows the safe restart path for an expired or already-consumed selection', () => {
    const message = '一次性身份选择信息不可用或已经消费，请返回登录入口重新验证。';
    const html = renderToStaticMarkup(
      <MembershipPage busy={false} error={message} hasSelection={false}>
        <span>secret</span>
      </MembershipPage>
    );
    expect(html).toContain(message);
    expect(html).toContain('role="alert"');
    expect(html).toContain('返回登录');
    expect(html).not.toContain('secret');
  });

  it('renders the explicit empty state when no membership remains active', () => {
    const html = renderToStaticMarkup(
      <MembershipPage busy={false} error="" hasSelection>
        <MembershipSelection memberships={[]} busy={false} onSelect={() => undefined} />
      </MembershipPage>
    );
    expect(html).toContain('当前没有可用的企业福利或运营身份');
  });
});
