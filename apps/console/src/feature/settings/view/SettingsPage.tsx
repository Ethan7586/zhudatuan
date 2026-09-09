import { JourneyGuide, ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { SettingsWorkspace } from '../model/Settings';
import { SettingsGroup } from './SettingsGroup';

const settingsJourney = Object.freeze([
  Object.freeze({ title: '选择任务分组', detail: '先按组织、资源、连接、安全或系统缩小范围。' }),
  Object.freeze({ title: '进入具体功能', detail: '每张卡片只对应一个清晰的管理目标。' }),
  Object.freeze({ title: '确认后生效', detail: '敏感修改会先展示影响，并要求安全验证。' }),
]);

export function SettingsPage({ title, model }: Readonly<{ title: string; model: SettingsWorkspace }>) {
  return (
    <ResourcePanel eyebrow={chineseSectionLabel('设置')} title={title} description="按业务任务查找当前范围已经开通的管理功能。" condition="ready" retry={() => undefined}>
      <div className="settingsworkspace">
        <section className="settingshero" aria-labelledby="settingsherotitle">
          <div>
            <span>设置中心</span>
            <h2 id="settingsherotitle">先选任务，再进入对应功能</h2>
            <p>相关功能放在同一个分组中，页面名称与实际结果保持一致，第一次使用也能快速找到入口。</p>
          </div>
          <dl>
            <div>
              <dt>任务分组</dt>
              <dd>{model.groups.length} 个</dd>
            </div>
            <div>
              <dt>可用功能</dt>
              <dd>{model.moduleCount} 项</dd>
            </div>
            <div>
              <dt>当前范围</dt>
              <dd>{model.scope}</dd>
            </div>
            <div>
              <dt>敏感操作</dt>
              <dd>{model.assurance}</dd>
            </div>
          </dl>
        </section>
        <JourneyGuide eyebrow="统一操作方式" title="三步完成一项设置" steps={settingsJourney} />
        {model.moduleCount === 0 ? (
          <section className="settingsempty" role="status">
            <strong>当前范围暂无可管理模块</strong>
            <span>切换组织范围或联系管理员授予所需能力后，模块会自动出现在这里。</span>
          </section>
        ) : (
          <div className="settingsgroups" aria-label="设置功能分组">
            {model.groups.map((group) => (
              <SettingsGroup key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </ResourcePanel>
  );
}
