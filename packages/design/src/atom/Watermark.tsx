export function Watermark({ value, timezone, stale }: Readonly<{ value: string; timezone: string; stale?: boolean }>) {
  return <p className="watermark" data-stale={stale ? 'true' : 'false'}><span aria-hidden="true" />数据截至 {value}（{timezone}）{stale ? '，当前数据存在延迟' : ''}</p>;
}
