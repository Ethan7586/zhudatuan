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

<<<<<<< HEAD
<<<<<<< HEAD
const failureStates = new Set<ResourceCondition>(['unauthenticated', 'denied', 'notfound', 'conflict', 'ratelimited', 'offline', 'failure']);
=======
const failureStates = new Set<ResourceCondition>(['denied', 'notfound', 'conflict', 'ratelimited', 'offline', 'failure']);
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
const failureStates = new Set<ResourceCondition>(['unauthenticated', 'denied', 'notfound', 'conflict', 'ratelimited', 'offline', 'failure']);
>>>>>>> 018b2a71 (chore(release): capture current production source)

export const Matrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--sw-space-3)' }}>
      {resourceConditions.map((condition) => (
        <section key={condition} aria-label={condition}>
          <h2>{condition}</h2>
<<<<<<< HEAD
<<<<<<< HEAD
          <ResourceState condition={condition} {...(failureStates.has(condition) ? { error: 'EXPLICIT_ERROR_CONTRACT' } : {})} retry={() => undefined}>
=======
          <ResourceState
            condition={condition}
            {...(failureStates.has(condition) ? { error: 'EXPLICIT_ERROR_CONTRACT' } : {})}
            retry={() => undefined}
          >
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
=======
          <ResourceState condition={condition} {...(failureStates.has(condition) ? { error: 'EXPLICIT_ERROR_CONTRACT' } : {})} retry={() => undefined}>
>>>>>>> 018b2a71 (chore(release): capture current production source)
            <p>最近一次成功读取的数据。</p>
          </ResourceState>
        </section>
      ))}
    </div>
  ),
};
