import type { ControlPlane } from './ControlSchema';

export function ControlHero({ plane, refreshing, onRefresh }: Readonly<{
  plane: ControlPlane | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}>) {
  return (
    <section className="controlhero" aria-labelledby="controltitle">
      <div>
        <p>SMART WING OPERATIONS CONTROL PLANE</p>
        <h1 id="controltitle">智慧翼中控台</h1>
        <strong>{plane?.conclusion ?? '平台态势等待读模型返回，未知状态不会显示为正常。'}</strong>
        <span>{plane?.summary ?? '当前没有可验证的能力覆盖信息。'}</span>
      </div>
      <WingMark />
      <button type="button" onClick={onRefresh} disabled={refreshing}>
        <RefreshIcon />{refreshing ? '刷新中' : '刷新态势'}
      </button>
    </section>
  );
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" /></svg>;
}

function WingMark() {
  return (
    <svg className="controlwing" viewBox="0 0 160 100" aria-hidden="true">
      <path d="M19 79c47-9 85-31 120-66-17 39-48 64-93 75 40-1 71-12 94-32-18 27-45 42-81 44" />
      <path d="M48 79c36-12 64-30 86-54M65 82c31-10 54-25 72-44M82 83c23-8 41-19 55-34" />
    </svg>
  );
}
