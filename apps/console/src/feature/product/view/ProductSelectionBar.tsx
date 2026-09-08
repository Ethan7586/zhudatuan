import { Button } from '@shop/design';

interface ProductSelectionBarProps {
  readonly count: number;
  readonly canBatch: boolean;
  readonly batchReason?: string;
  readonly onBatch: (published: boolean) => void;
}

export function ProductSelectionBar({ count, canBatch, batchReason, onBatch }: ProductSelectionBarProps) {
  if (count === 0) return null;
  return (
    <div className="productselectionbar" role="status">
      <span>
        已选择当前页 <strong>{count}</strong> 项
      </span>
      <span>仅处理当前页已选记录，服务端按可见范围再次收敛</span>
      <Button onPress={() => onBatch(true)} isDisabled={!canBatch}>
        批量上架
      </Button>
      <Button onPress={() => onBatch(false)} isDisabled={!canBatch}>
        批量下架
      </Button>
      {!canBatch && batchReason ? <small>{batchReason}</small> : null}
    </div>
  );
}
