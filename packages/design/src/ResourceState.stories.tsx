import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResourceState, resourceConditions, type ResourceCondition } from './ResourceState';

const meta = {
  title: '状态/ResourceState',
  component: ResourceState,
  args: {
    condition: 'ready',
    children: null,
  },
} satisfies Meta<typeof ResourceState>;

export default meta;
type Story = StoryObj<typeof meta>;

const failureStates = new Set<ResourceCondition>(['unauthenticated', 'denied', 'notfound', 'conflict', 'ratelimited', 'offline', 'failure']);

export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--sw-space-3)' }}>
      {resourceConditions.map((condition) => (
        <section key={condition} aria-label={condition}>
          <h2>{condition}</h2>
          <ResourceState condition={condition} {...(failureStates.has(condition) ? { error: 'EXPLICIT_ERROR_CONTRACT' } : {})} retry={() => undefined}>
            <p>最近一次成功读取的数据。</p>
          </ResourceState>
        </section>
      ))}
    </div>
  ),
};
