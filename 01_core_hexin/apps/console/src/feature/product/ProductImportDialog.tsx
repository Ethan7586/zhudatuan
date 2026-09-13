import { Button, Dialog } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useState, type ChangeEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import {
  canCreateCatalogImport,
  createCatalogImport,
  downloadCatalogPackageTemplate,
  previewCatalogPackage,
  type CatalogPackagePreview,
} from './ProductImportCommand';

export function ProductImportDialog({
  context,
  open,
  onClose,
  onCreated,
  embedded = false,
}: Readonly<{
  context: ConsoleContext;
  open: boolean;
  onClose: () => void;
  onCreated: (jobId: string) => void;
  embedded?: boolean;
}>) {
  const [file, setFile] = useState<File>();
  const [content, setContent] = useState<string>();
  const [preview, setPreview] = useState<CatalogPackagePreview>();
  const [validationError, setValidationError] = useState<string>();
  const available = canCreateCatalogImport(context);
  const mutation = useMutation({
    mutationFn: () => createCatalogImport(context, file!.name, content!),
    onSuccess: (receipt) => onCreated(receipt.id),
  });

  const resetAndClose = () => {
    if (mutation.isPending) return;
    mutation.reset();
    setFile(undefined);
    setContent(undefined);
    setPreview(undefined);
    setValidationError(undefined);
    onClose();
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    mutation.reset();
    setFile(selected);
    setContent(undefined);
    setPreview(undefined);
    setValidationError(undefined);
    if (selected === undefined) return;
    try {
      const result = await previewCatalogPackage(selected);
      setContent(result.content);
      setPreview(result.preview);
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : '无法读取标准货盘包');
    }
  };

  const formContent = (
    <div className="productimportdialog">
        <p>上传固定版本标准包。系统先校验并生成预览；只有你在结果页确认后，才会保存商品草稿、售价和库存。</p>
        <div className="productimporttools">
          <Button onPress={downloadCatalogPackageTemplate}>下载标准模板</Button>
          <span>JSON · catalog-package/v1</span>
        </div>
        <label className="productfilepicker">
          选择标准货盘包
          <input type="file" accept=".json,application/json" disabled={mutation.isPending}
            onClick={(event) => { event.currentTarget.value = ''; }} onChange={(event) => { void selectFile(event); }} />
        </label>
        {preview === undefined ? null : (
          <dl className="productimportsummary" aria-label="本地结构预览">
            <div><dt>货盘编号</dt><dd>{preview.packageId}</dd></div>
            <div><dt>来源</dt><dd>{preview.source}</dd></div>
            <div><dt>商品行</dt><dd>{preview.items}</dd></div>
            <div><dt>编译标记</dt><dd>{preview.valid} 有效 / {preview.invalid} 待修</dd></div>
          </dl>
        )}
        {!available ? <p className="productcommanderror" role="status">请切换到已授权商城范围后再上传。</p> : null}
        {validationError === undefined ? null : <p className="productcommanderror" role="alert">{validationError}</p>}
        {mutation.error === null ? null : <p className="productcommanderror" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : '标准货盘包上传失败'}
        </p>}
        <footer>
          <Button isDisabled={mutation.isPending} onPress={resetAndClose}>取消</Button>
          <Button tone="primary" isDisabled={!available || content === undefined || preview === undefined || mutation.isPending}
            onPress={() => mutation.mutate()}>{mutation.isPending ? '正在上传…' : '上传并校验'}</Button>
        </footer>
    </div>
  );

  if (embedded) return <section className="productimportembedded" aria-label="批量导入自有商品">{formContent}</section>;

  return (
    <Dialog open={open} title="批量导入商品" eyebrow="CATALOG PACKAGE / V1" dismissable={!mutation.isPending} onClose={resetAndClose}>
      {formContent}
    </Dialog>
  );
}
