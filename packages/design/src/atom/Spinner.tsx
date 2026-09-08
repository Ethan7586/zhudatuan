export function Spinner({ label = '正在处理' }: Readonly<{ label?: string }>) {
  return <span className="shopspinner" role="status" aria-label={label}><span aria-hidden="true" /></span>;
}
