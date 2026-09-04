import type { ValidationIssue } from '../model/Experience';

export function ValidationPanel({ issues, onLocate }: Readonly<{ issues: readonly ValidationIssue[]; onLocate: (path: string) => void }>) {
  return (
    <section className="designervalidation" aria-labelledby="designervalidationtitle">
      <header>
        <strong id="designervalidationtitle">发布校验</strong>
        <small>{issues.length === 0 ? '尚无阻断项' : `${issues.length} 项待处理`}</small>
      </header>
      {issues.length === 0 ? <p>保存后点击“校验版本”，系统会检查页面、商品、资产、域名与发布依赖。</p> : null}
      <ol>
        {issues.map((issue) => (
          <li key={`${issue.code}:${issue.path}`}>
            <button type="button" onClick={() => onLocate(issue.path)}>
              <strong>{issue.message}</strong>
              <small>定位：{friendlyPath(issue.path)}</small>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function friendlyPath(path: string): string {
  if (path.startsWith('pages.')) return path.replace(/^pages\.(\d+)\.blocks\.(\d+)/, '第 $1 页 · 第 $2 个组件');
  if (path.startsWith('navigation')) return '页面导航';
  if (path.startsWith('theme')) return '品牌主题';
  if (path === 'assets' || path.startsWith('assets.')) return '视觉资源';
  if (path.startsWith('dependencies.') || path.startsWith('bindings.') || path === 'domain' || path === 'channels') return '发布前置条件';
  return '装修配置';
}
