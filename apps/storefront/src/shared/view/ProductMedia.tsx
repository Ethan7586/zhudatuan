export function ProductMedia({
  source,
  alt,
  className,
  emptyClassName,
  emptyText = '暂无商品图片',
}: {
  readonly source: string | null | undefined;
  readonly alt: string;
  readonly className: string;
  readonly emptyClassName: string;
  readonly emptyText?: string;
}) {
  const normalized = source?.trim();
  return normalized ? <img src={normalized} alt={alt} className={className} loading="lazy" decoding="async" /> : <span className={emptyClassName}>{emptyText}</span>;
}
