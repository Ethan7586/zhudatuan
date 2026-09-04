import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { Brand } from './Brand';
import { Button } from './Button';
import { MasterDetail, MasterItem } from './MasterDetail';
import { MetricCard, MetricGrid } from './WorkspaceMetrics';
import { WorkspaceHero } from './WorkspaceHero';
import './vi-1-2-story.css';

const meta = {
  title: 'VI 1.2 基础组件/工作台组合',
  parameters: { layout: 'fullscreen', controls: { disable: true } },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function FoundationPreview() {
  return (
    <main className="vi12preview" data-sw-theme="light">
      <WorkspaceHero
        identity={<Brand inverse product="Product Design System" variant="mark" />}
        eyebrow="Smart Wing workspace foundation"
        title="清晰、克制、有层次的企业工作台"
        description="VI 1.2 把英雄区、指标、主从布局和可选择列表沉淀为稳定组件；业务模块逐个接入，互不牵连。"
        meta={
          <>
            <span>Version · 1.2.0</span>
            <span>Status · Foundation ready</span>
          </>
        }
        actions={
          <>
            <Button>查看规范</Button>
            <Button tone="primary">创建工作台</Button>
          </>
        }
      />

      <section className="vi12previewsection" aria-labelledby="vi12-metrics-title">
        <header>
          <p className="swoverline">Metrics</p>
          <h2 id="vi12-metrics-title">统一指标层级</h2>
        </header>
        <MetricGrid columns="four">
          <MetricCard label="活跃成员" value="12,860" trend="+8.6%" description="较上周期" tone="success" />
          <MetricCard label="待处理任务" value="24" trend="需关注" description="今日" tone="warning" />
          <MetricCard label="策略覆盖" value="98.4%" trend="稳定" description="全部范围" tone="info" />
          <MetricCard label="异常规则" value="0" trend="正常" description="实时校验" tone="neutral" />
        </MetricGrid>
      </section>

      <section className="vi12previewsection" aria-labelledby="vi12-master-title">
        <header>
          <p className="swoverline">Master detail</p>
          <h2 id="vi12-master-title">统一主从工作区</h2>
        </header>
        <MasterDetail
          masterLabel="角色列表"
          detailLabel="角色详情"
          master={
            <div className="vi12masterlist">
              <MasterItem selected title="平台 Owner" description="全部平台范围" meta="18 位成员" trailing={<Badge tone="info">系统</Badge>} />
              <MasterItem title="运营管理员" description="商城与活动范围" meta="32 位成员" trailing={<Badge>自定义</Badge>} />
              <MasterItem disabled title="财务观察员" description="只读财务范围" meta="暂未启用" />
            </div>
          }
          detail={
            <article className="vi12detailpreview">
              <p className="swoverline">Role profile</p>
              <h2>平台 Owner</h2>
              <p>使用稳定的内容层级承载成员、作用域、允许和明确禁止；组件只负责交互骨架，不绑定权限业务。</p>
              <div className="vi12tagrow">
                <Badge tone="info">平台角色</Badge>
                <Badge tone="success">已启用</Badge>
                <Badge tone="danger">明确禁止 2</Badge>
              </div>
            </article>
          }
        />
      </section>
    </main>
  );
}

export const CompleteFoundation: Story = { render: () => <FoundationPreview /> };
