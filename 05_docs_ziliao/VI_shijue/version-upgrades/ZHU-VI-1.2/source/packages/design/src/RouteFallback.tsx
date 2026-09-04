import { ResourceState } from './ResourceState';

export function RouteFallback() {
  return (
    <main className="statemain" aria-label="页面加载状态">
      <ResourceState condition="loading">
        <span />
      </ResourceState>
    </main>
  );
}
