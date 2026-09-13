import type { ConsoleModuleManifest } from '../../entity/navigation/ConsoleModuleManifest';

export const engineeringModule = {
  id: 'engineering',
  status: 'enabled',
  navigation: {
    placement: 'bottom',
    group: 'organization',
    order: 120,
    label: '工程与架构',
    icon: 'system',
    preferredScopeKind: 'platform',
  },
  routes: [
    {
      id: 'engineering.index',
      path: 'system/engineering',
      kind: 'entry',
      lazy: () => import('./EngineeringRoute'),
      operations: ['runtime.health.dependency'],
      presentation: { title: '工程与架构中心', summary: '系统架构、技术能力、发布基础设施与演进记录' },
    },
    {
      id: 'engineering.status',
      path: 'system/status',
      kind: 'child',
      lazy: () => import('./RuntimeStatusRoute'),
      operations: ['runtime.health.dependency'],
      presentation: { title: '系统运行状态', summary: 'L0、L1 与 L2 的服务健康、性能和依赖关系' },
    },
    {
      id: 'engineering.releases',
      path: 'system/releases',
      kind: 'child',
      lazy: () => import('./ReleaseVersionRoute'),
      operations: ['runtime.health.dependency'],
      presentation: { title: '发布与版本', summary: '不可变制品、生产版本、回滚点与自然迁移进度' },
    },
    {
      id: 'engineering.incidents',
      path: 'system/incidents',
      kind: 'child',
      lazy: () => import('./IncidentTechnologyRoute'),
      operations: ['runtime.health.dependency'],
      presentation: { title: '故障与技术支持', summary: '生产故障、技术问题、处置进度与复盘知识' },
    },
  ],
} as const satisfies ConsoleModuleManifest<'engineering'>;
