import { CONSOLE_RELEASES } from '../../entity/release/ConsoleReleaseLedger';
import { requireConsoleRuntimeConfig } from '../../shared/config/RuntimeConfig';
import { EngineeringFrame, HonestNotice, StatusPill } from './EngineeringFrame';

export function Component() {
  const runtimeSourceSha = readRuntimeSourceSha();
  return <EngineeringFrame eyebrow="SYSTEM GOVERNANCE · RELEASES"
    title="发布与版本" description="查看已经进入生产环境的功能、优化和修复记录">
    <header className="engineeringreleaseheading">
      <div><h2>版本更新记录</h2><p>每次生产发布形成一条记录，最新版本位于最上方。</p></div>
      <span>当前生产版本 <strong>{CONSOLE_RELEASES[0].version}</strong></span>
    </header>

    <ol className="engineeringreleaselist">
      {CONSOLE_RELEASES.map((release, index) => <li key={release.version}>
        <details open={index === 0}>
          <summary>
            <strong>{release.version}</strong>
            <span><b>{release.title}</b><small>{release.releasedAt} · {release.surface}</small></span>
            <StatusPill tone={release.status === 'infrastructure' ? 'information' : 'ready'}>
              {release.status === 'current' ? '当前生产' : release.status === 'infrastructure' ? '基础设施' : '已上线'}
            </StatusPill>
          </summary>
          <div className="engineeringreleasebody">
            <div className="engineeringreleasechanges">
              {release.changes.map((group) => <section key={group.kind}>
                <h3>{group.kind}</h3>
                <ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul>
              </section>)}
            </div>
            <dl className="engineeringreleasetechnical">
              <div><dt>生产提交</dt><dd><code>{release.status === 'current' ? runtimeSourceSha : release.sourceSha?.slice(0, 8)}</code></dd></div>
              <div><dt>部署通道</dt><dd>{release.channel}</dd></div>
              <div><dt>运行目标</dt><dd>{release.target}</dd></div>
            </dl>
          </div>
        </details>
      </li>)}
    </ol>

    <HonestNotice title="版本登记规则">
      功能说明随不可变制品一起准备；只有完成生产部署的版本才进入本页，提交但未部署的改动不标记为已上线。
    </HonestNotice>
  </EngineeringFrame>;
}

function readRuntimeSourceSha(): string {
  try {
    return requireConsoleRuntimeConfig().sourceSha.slice(0, 8);
  } catch {
    return '本地预览';
  }
}
