import { Button, Dialog, Form } from '@shop/design';
import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { canCreateCatalogImport, createCatalogImport, manualCatalogPackage, type ManualProductDraft } from './ProductImportCommand';

export function ProductCreateDialog({
  context,
  open,
  onClose,
  onCreated,
}: Readonly<{
  context: ConsoleContext;
  open: boolean;
  onClose: () => void;
  onCreated: (jobId: string) => void;
}>) {
  const [validationError, setValidationError] = useState<string>();
  const available = canCreateCatalogImport(context);
  const mutation = useMutation({
    mutationFn: (draft: ManualProductDraft) => createCatalogImport(context, 'console-manual.json', manualCatalogPackage(draft)),
    onSuccess: (receipt) => onCreated(receipt.id),
  });

  const resetAndClose = () => {
    if (mutation.isPending) return;
    mutation.reset();
    setValidationError(undefined);
    onClose();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError(undefined);
    mutation.reset();
    try {
      const form = new FormData(event.currentTarget);
      const mediaUrl = requiredText(form, 'mediaUrl');
      const media = new URL(mediaUrl);
      if (media.protocol !== 'https:') throw new Error('商品图片必须使用 HTTPS 地址');
      const amountMinor = money(form.get('amount'));
      const compare = optionalMoney(form.get('compareAmount'));
      if (compare !== undefined && compare < amountMinor) throw new Error('划线价不能低于售价');
      const stock = integer(form.get('available'), '库存');
      mutation.mutate({
        title: requiredText(form, 'title'),
        description: requiredText(form, 'description'),
        category: requiredText(form, 'category'),
        productType: requiredText(form, 'productType') as ManualProductDraft['productType'],
        skuCode: requiredText(form, 'skuCode'),
        mediaUrl,
        amountMinor,
        ...(compare === undefined ? {} : { compareMinor: compare }),
        available: stock,
        specifications: { 规格: requiredText(form, 'specification') },
      });
    } catch (cause) {
      setValidationError(cause instanceof Error ? cause.message : '请检查商品字段');
    }
  };

  return (
    <Dialog open={open} title="新建商品" eyebrow="MANUAL PRODUCT → DRAFT" dismissable={!mutation.isPending} onClose={resetAndClose}>
      <Form className="productcreateform" label="新建商品" onSubmit={submit}>
        <p>先提交服务端校验；在结果页确认后保存为当前商城的商品草稿，不会自动上架。</p>
        <div className="productcreategrid">
          <label>商品标题<input name="title" required maxLength={300} /></label>
          <label>SKU 编码<input name="skuCode" required maxLength={128} /></label>
          <label>分类编码<input name="category" required maxLength={128} placeholder="例如 personal" /></label>
          <label>商品类型<select name="productType" defaultValue="physical">
            <option value="physical">实物</option><option value="virtual">虚拟</option>
            <option value="service">服务</option><option value="voucher">券码</option>
          </select></label>
          <label>售价（元）<input name="amount" required inputMode="decimal" placeholder="99.00" /></label>
          <label>划线价（元，可选）<input name="compareAmount" inputMode="decimal" placeholder="129.00" /></label>
          <label>可用库存<input name="available" required inputMode="numeric" defaultValue="0" /></label>
          <label>规格<input name="specification" required defaultValue="标准" maxLength={200} /></label>
          <label className="productcreatewide">图片 HTTPS 地址<input name="mediaUrl" type="url" required placeholder="https://cdn.example.com/product.jpg" /></label>
          <label className="productcreatewide">商品描述<textarea name="description" required maxLength={5000} rows={4} /></label>
        </div>
        {!available ? <p className="productcommanderror" role="status">请切换到已授权商城范围后再新建商品。</p> : null}
        {validationError === undefined ? null : <p className="productcommanderror" role="alert">{validationError}</p>}
        {mutation.error === null ? null : <p className="productcommanderror" role="alert">
          {mutation.error instanceof Error ? mutation.error.message : '商品提交失败'}
        </p>}
        <footer>
          <Button isDisabled={mutation.isPending} onPress={resetAndClose}>取消</Button>
          <Button type="submit" tone="primary" isPending={mutation.isPending} isDisabled={!available}>提交校验</Button>
        </footer>
      </Form>
    </Dialog>
  );
}

function requiredText(form: FormData, key: string): string {
  const entry = form.get(key);
  const value = typeof entry === 'string' ? entry.trim() : '';
  if (!value) throw new Error('请填写所有必填字段');
  return value;
}

function money(value: FormDataEntryValue | null): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$/.test(text)) throw new Error('售价须为最多两位小数的非负金额');
  return Math.round(Number(text) * 100);
}

function optionalMoney(value: FormDataEntryValue | null): number | undefined {
  return typeof value !== 'string' || value.trim() === '' ? undefined : money(value);
}

function integer(value: FormDataEntryValue | null, label: string): number {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!/^(0|[1-9][0-9]{0,14})$/.test(text)) throw new Error(`${label}须为非负整数`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label}超出可支持范围`);
  return parsed;
}
