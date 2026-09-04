import type { SettingsModule } from '../model/Settings';

export function SettingsCard({ module, tone }: Readonly<{ module: SettingsModule; tone: number }>) {
  return (
    <article className="settingscard" data-tone={tone}>
      <div className="settingsicon" aria-hidden="true">
        {module.title.slice(0, 1)}
      </div>
      <div>
        <span>当前范围已授权</span>
        <h2>{module.title}</h2>
        <p>进入当前范围内已授权的管理工作台，所有读取与操作继续遵循服务端权限和数据边界。</p>
      </div>
      <a href={module.href} aria-label={`进入${module.title}`}>
        进入管理 <span aria-hidden="true">→</span>
      </a>
    </article>
  );
}
