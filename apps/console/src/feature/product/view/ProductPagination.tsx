import { Button } from '@shop/design';
import { ProductIcon } from './ProductIcon';

interface ProductPaginationProps {
  readonly count: number;
  readonly total?: number;
  readonly page: number;
  readonly limit: number;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly onPrevious: () => void;
  readonly onNext: () => void;
  readonly onLimit: (limit: number) => void;
}

export function ProductPagination({ count, total, page, limit, canPrevious, canNext, onPrevious, onNext, onLimit }: ProductPaginationProps) {
  const start = count === 0 ? 0 : (page - 1) * limit + 1;
  const end = count === 0 ? 0 : start + count - 1;
  const pageCount = total === undefined ? undefined : Math.max(1, Math.ceil(total / limit));
  return (
    <footer className="productpagination" aria-label="商品分页">
      <p>{total === undefined ? `本页 ${formatCount(count)} 件 · 总量暂不可用` : `${formatCount(start)}–${formatCount(Math.min(end, total))} / 共 ${formatCount(total)} 件`}</p>
      <label>
        每页{' '}
        <select aria-label="每页数量" value={limit} onChange={(event) => onLimit(Number(event.target.value))}>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </label>
      <div className="productpagebuttons">
        <Button tone="quiet" aria-label="上一页" isDisabled={!canPrevious} onPress={onPrevious}>
          <ProductIcon name="arrowLeft" />
        </Button>
        <strong aria-current="page">{page}</strong>
        {pageCount === undefined ? null : (
          <>
            <span>/</span>
            <span>{pageCount}</span>
          </>
        )}
        <Button tone="quiet" aria-label="下一页" isDisabled={!canNext} onPress={onNext}>
          <ProductIcon name="arrowRight" />
        </Button>
      </div>
    </footer>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}
