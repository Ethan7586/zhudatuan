import { Button, ImportPanel } from '@shop/design';
import type { ProductImportViewModel } from '../viewmodel/ProductImportViewModel';
import { ProductFlowModal } from './ProductFlowModal';
import { ProductIcon } from './ProductIcon';
import { ProductImportOutcome } from './ProductImportOutcome';
import { ProductImportSetup } from './ProductImportSetup';

const steps = ['模板', '上传', '映射', '校验', '提交', '任务'] as const;

export function ProductImportDialog({ viewmodel }: Readonly<{ viewmodel: ProductImportViewModel }>) {
  return (
    <ProductFlowModal open={viewmodel.open} label="商品导入" onClose={viewmodel.actions.close} dismissable={!viewmodel.busy} className="productimportdialog">
      <form className="productflowcontent" aria-label="商品导入" onSubmit={(event) => event.preventDefault()}>
        <header>
          <div>
            <p>服务端受控导入</p>
            <h2>导入商品</h2>
          </div>
          <Button className="productflowclose" tone="quiet" onPress={viewmodel.actions.close} aria-label="关闭商品导入窗口" isDisabled={viewmodel.busy}>
            <ProductIcon name="close" />
          </Button>
        </header>
        <div className="productflowbody">
          <ImportPanel steps={steps} current={viewmodel.step} label="商品导入步骤" stepsClassName="productimportsteps">
            <ProductImportSetup viewmodel={viewmodel} />
            <ProductImportOutcome viewmodel={viewmodel} />
          </ImportPanel>
        </div>
      </form>
    </ProductFlowModal>
  );
}
