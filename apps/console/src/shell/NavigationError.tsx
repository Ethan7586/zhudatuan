import { ResourcePanel } from '@shop/design';

export type NavigationErrorKind = 'catalog' | 'dependency' | 'session';

export function NavigationError({ kind }: Readonly<{ kind: NavigationErrorKind }>) {
  const content =
    kind === 'catalog'
      ? { title: '控制台需要更新', message: '导航版本与当前页面不一致，请刷新后重试。' }
      : kind === 'session'
        ? { title: '会话已失效', message: '请重新登录后继续。' }
        : { title: '控制台暂时不可用', message: '依赖服务暂时不可用，请稍后重试。' };
  return (
    <main className="routeerror">
      <ResourcePanel title={content.title} condition="failure" error={content.message}>
        <span />
      </ResourcePanel>
    </main>
  );
}
