export function Skeleton({ label = '正在加载', lines = 1 }: Readonly<{ label?: string; lines?: number }>) {
  const safeLines = Math.min(8, Math.max(1, Math.trunc(lines)));
  return <span className="shopskeleton" role="status" aria-label={label}>{Array.from({ length: safeLines }, (_, index) => <span key={index} aria-hidden="true" />)}</span>;
}
