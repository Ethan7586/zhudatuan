import { useLocation } from 'react-router';
import { scopeSuffix } from '../../route/ProfessionalRouteCatalog';
import { EngineeringOverviewContent } from './EngineeringRoute';
import { EngineeringFrame, type EngineeringViewId } from './EngineeringFrame';
import { IncidentTechnologyContent } from './IncidentTechnologyRoute';
import { ReleaseVersionContent } from './ReleaseVersionRoute';
import { RuntimeStatusContent } from './RuntimeStatusRoute';

const views = [
  {
    id: 'engineering', suffix: 'system/engineering', eyebrow: 'SYSTEM GOVERNANCE · ENGINEERING',
    title: '工程与架构中心', description: '统一查看系统架构、技术能力、发布基础设施与演进记录',
    Content: EngineeringOverviewContent,
  },
  {
    id: 'status', suffix: 'system/status', eyebrow: 'SYSTEM GOVERNANCE · OBSERVABILITY',
    title: '系统运行状态', description: '统一观察 L0、L1 与 L2 的服务健康、性能和依赖关系',
    Content: RuntimeStatusContent,
  },
  {
    id: 'releases', suffix: 'system/releases', eyebrow: 'SYSTEM GOVERNANCE · RELEASES',
    title: '发布与版本', description: '查看已经进入生产环境的功能、优化和修复记录',
    Content: ReleaseVersionContent,
  },
  {
    id: 'incidents', suffix: 'system/incidents', eyebrow: 'SYSTEM GOVERNANCE · INCIDENTS',
    title: '故障与技术支持', description: '统一记录生产故障、技术问题、处置进度与复盘知识',
    Content: IncidentTechnologyContent,
  },
] as const;

export function Component() {
  const location = useLocation();
  const suffix = scopeSuffix(location.pathname);
  const active = views.find((view) => view.suffix === suffix) ?? views[0];

  return <EngineeringFrame eyebrow={active.eyebrow} title={active.title}
    description={active.description} activeView={active.id}>
    {views.map(({ id, Content }) => <section key={id} className="engineeringview"
      role="tabpanel" aria-label={viewLabel(id)} hidden={id !== active.id}>
      <Content />
    </section>)}
  </EngineeringFrame>;
}

function viewLabel(id: EngineeringViewId): string {
  return views.find((view) => view.id === id)?.title ?? '工程与架构中心';
}
