import { ImportPanel } from '@shop/design';
import type { ProductImportViewModel } from '../viewmodel/ProductImportViewModel';
import { ProductImportOutcome } from './ProductImportOutcome';
import { ProductImportSetup } from './ProductImportSetup';

const steps = ['模板', '上传', '映射', '校验', '提交', '任务'] as const;

export function ProductImportDialog({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  if (!viewmodel.open) return null;
  return (
    <div className="productflowoverlay">
      <button className="productflowbackdrop" type="button" onClick={viewmodel.actions.close} aria-label="关闭商品导入窗口" />
      <form className="productflowdialog productimportdialog" aria-label="商品导入" onSubmit={(event) => event.preventDefault()}>
        <header>
          <div>
            <p>服务端受控导入</p>
            <h2>导入商品</h2>
          </div>
          <button type="button" onClick={viewmodel.actions.close} aria-label="关闭商品导入窗口">
            ×
          </button>
        </header>
        <div className="productflowbody">
          <ImportPanel steps={steps} current={viewmodel.step} label="商品导入步骤" stepsClassName="productimportsteps">
            <ProductImportSetup viewmodel={viewmodel} />
            <ProductImportOutcome viewmodel={viewmodel} />
          </ImportPanel>
        </div>
      </form>
    </div>
  );
}
