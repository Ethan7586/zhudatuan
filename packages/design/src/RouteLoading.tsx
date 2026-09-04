import { ResourceState } from './ResourceState';
export function RouteLoading() {
  return (
    <div className="statemain">
      <ResourceState condition="loading">
        <span />
      </ResourceState>
    </div>
  );
}
