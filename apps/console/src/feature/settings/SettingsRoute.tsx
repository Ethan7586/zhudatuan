import { ResourcePanel } from '@shop/design';
import { Link, useOutletContext } from 'react-router';
import { useConsoleContext } from '../../entity/session/ConsoleContext';
import type { ConsoleNavigationNode, ConsoleScope } from '../../entity/session/ConsoleSession';
import { navigationPath } from '../../shared/url/NavigationPath';
import { useRouteTitle } from '../../shared/ui/RouteTitle';
import './Settings.css';

const descriptions: Readonly<Record<string, string>> = Object.freeze({
  access: '配置管理员角色、成员权限、项目范围与安全邀请。',
  member: '维护成员资料、在职状态和组织成员关系。',
  partner: '集中管理供应商与门店档案、状态和服务边界。',
});

export function Component() {
  const context = useConsoleContext();
  const { nodes, scope } = useOutletContext<Readonly<{ nodes: readonly ConsoleNavigationNode[]; scope: ConsoleScope }>>();
  const title = useRouteTitle('会员与权限');
  const enabled = nodes.filter((node) => !node.disabled).length;
  return (
    <ResourcePanel eyebrow="SMART WING · MEMBER AND ACCESS" title={title} description="一个入口完成成员、管理员权限、项目范围以及供应商与门店治理。" condition="ready" retry={() => undefined}>
      <div className="settingsworkspace">
        <section className="settingshero" aria-labelledby="settingsherotitle">
          <div>
            <span>组织治理工作台</span>
            <h2 id="settingsherotitle">让每位成员只在正确的范围内完成正确的事</h2>
            <p>服务端统一投影菜单与能力；所有编辑仍经过真实权限、版本、安全验证和审计链路。</p>
          </div>
          <dl>
            <div>
              <dt>可用模块</dt>
              <dd>
                {enabled}/{nodes.length}
              </dd>
            </div>
            <div>
              <dt>安全验证</dt>
              <dd>第 {context.session.assurance.level} 级</dd>
            </div>
            <div>
              <dt>当前范围</dt>
              <dd>{scope.name ?? scope.kind}</dd>
            </div>
            <div>
              <dt>授权策略</dt>
              <dd>默认拒绝</dd>
            </div>
          </dl>
        </section>
        <section className="settingsgrid" aria-label="会员与权限功能">
          {nodes.map((node, index) => (
            <article key={node.id} className="settingscard" data-tone={(index % 3) + 1}>
              <div className="settingsicon" aria-hidden="true">
                {node.title.slice(0, 1)}
              </div>
              <div>
                <span>{node.disabled ? '能力暂不可用' : '已授权'}</span>
                <h2>{node.title}</h2>
                <p>{descriptions[node.component] ?? '进入当前范围内已授权的管理工作台。'}</p>
              </div>
              {node.disabled ? (
                <span className="settingsdisabled">暂不可用</span>
              ) : (
                <Link to={navigationPath(node, scope)}>
                  进入管理 <span aria-hidden="true">→</span>
                </Link>
              )}
            </article>
          ))}
        </section>
        <section className="settingssecurity" aria-label="安全边界">
          <div>
            <strong>角色与范围分离</strong>
            <span>Role、Scope、Override 各自建模，拒绝规则始终优先。</span>
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
