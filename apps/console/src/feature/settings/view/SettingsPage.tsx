import { ResourcePanel } from '@shop/design';
import { chineseSectionLabel } from '@shop/presentation';
import type { SettingsWorkspace } from '../model/Settings';
import { SettingsCard } from './SettingsCard';

export function SettingsPage({ title, model }: Readonly<{ title: string; model: SettingsWorkspace }>) {
  return (
    <ResourcePanel eyebrow={chineseSectionLabel('会员与权限')} title={title} description="一个入口完成当前范围已经授权并安装的组织治理能力。" condition="ready" retry={() => undefined}>
      <div className="settingsworkspace">
        <section className="settingshero" aria-labelledby="settingsherotitle">
          <div>
            <span>组织治理工作台</span>
            <h2 id="settingsherotitle">让每位成员只在正确的范围内完成正确的事</h2>
            <p>服务端统一投影菜单与能力，前端只呈现已经注册的模块；所有编辑继续经过版本、安全验证和审计链路。</p>
          </div>
          <dl>
            <div>
              <dt>可用模块</dt>
              <dd>{model.modules.length}</dd>
            </div>
            <div>
              <dt>安全验证</dt>
              <dd>{model.assurance}</dd>
            </div>
            <div>
              <dt>当前范围</dt>
              <dd>{model.scope}</dd>
            </div>
            <div>
              <dt>授权策略</dt>
              <dd>默认拒绝</dd>
            </div>
          </dl>
        </section>
        {model.modules.length === 0 ? (
          <section className="settingsempty" role="status">
            <strong>当前范围暂无可管理模块</strong>
            <span>切换组织范围或联系管理员授予所需能力后，模块会自动出现在这里。</span>
          </section>
        ) : (
          <section className="settingsgrid" aria-label="会员与权限功能">
            {model.modules.map((module, index) => (
              <SettingsCard key={module.id} module={module} tone={(index % 3) + 1} />
            ))}
          </section>
        )}
        <section className="settingssecurity" aria-label="安全边界">
          <div>
            <strong>角色与范围分离</strong>
            <span>角色、数据范围、成员覆盖权限各自建模，拒绝规则始终优先。</span>
          </div>
          <div>
            <strong>关键操作双人复核</strong>
            <span>高强度二次验证、一次性复核凭证、目标版本校验与防重复提交缺一不可。</span>
          </div>
          <div>
            <strong>成员历史完整保留</strong>
            <span>状态迁移代替物理删除，业务记录与审计证据持续可追溯。</span>
          </div>
        </section>
      </div>
    </ResourcePanel>
  );
}
