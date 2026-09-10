import { useEffect, useRef, useState } from 'react';
import { Button } from '@shop/design';
import { PRODUCT_IMAGE_GUIDANCE } from '../model/ProductImagePolicy';
import type { ProductImageProgress } from '../model/Product';
import { ProductIcon } from './ProductIcon';

export interface ProductImageFieldProps {
  readonly current?: string | undefined;
  readonly image: File | null | undefined;
  readonly error?: string | undefined;
  readonly canChoose: boolean;
  readonly permissionReason?: string | undefined;
  readonly disabled: boolean;
  readonly progress?: ProductImageProgress | undefined;
  readonly title: string;
  readonly onChoose: (file: File) => void;
  readonly onRemove: () => void;
}

export function ProductImageField({ current, image, error, canChoose, permissionReason, disabled, progress, title, onChoose, onRemove }: Readonly<ProductImageFieldProps>) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!(image instanceof File) || typeof URL.createObjectURL !== 'function') {
      setPreview(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL?.(objectUrl);
  }, [image]);
  const source = image === null ? undefined : (preview ?? current);
  const hasImage = source !== undefined || image instanceof File;
  const description = error === undefined ? 'productimageguidance' : 'productimageguidance productimageerror';
  return (
    <fieldset className="productimagefield" disabled={disabled}>
      <legend>商品图片</legend>
      <div className="productimagecontent">
        <div className="productimagepreview" data-empty={source === undefined ? 'true' : 'false'}>
          {source === undefined ? (
            <div>
              <ProductIcon name="upload" />
              <span>添加一张清晰的商品主图</span>
            </div>
          ) : (
            <img src={source} alt={`${title.trim() || '商品'}${image instanceof File ? '待上传图片' : '当前图片'}`} />
          )}
        </div>
        <div className="productimagecontrols">
          <input
            ref={input}
            className="productimageinput"
            type="file"
            hidden
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            aria-label="选择商品图片"
            aria-describedby={description}
            disabled={disabled || !canChoose}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) onChoose(file);
              event.target.value = '';
            }}
          />
          <div className="productimageactions">
            <Button type="button" onPress={() => input.current?.click()} isDisabled={disabled || !canChoose}>
              <ProductIcon name="upload" />
              {hasImage ? '替换图片' : '选择图片'}
            </Button>
            <Button type="button" tone="quiet" onPress={onRemove} isDisabled={disabled || !hasImage}>
              移除图片
            </Button>
          </div>
          <p id="productimageguidance">{PRODUCT_IMAGE_GUIDANCE} 图片会安全上传至 OSS，保存商品后正式生效。</p>
          {error === undefined ? null : (
            <p id="productimageerror" className="productimagevalidation" role="alert">
              {error}
            </p>
          )}
          {canChoose || permissionReason === undefined ? null : <p className="productimagepermission">{permissionReason}</p>}
          {image instanceof File ? <p className="productimageselected">已选择：{image.name}</p> : image === null ? <p className="productimageselected">保存后移除当前图片</p> : null}
          {progress === undefined ? null : (
            <div className="productimageprogress" role="status" aria-live="polite">
              <progress max={progress.total} value={Math.min(progress.processed, progress.total)} />
              <span>
                {progress.stage === 'checking' ? '正在安全校验图片' : '正在上传至 OSS'}，{percentage(progress)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function percentage(progress: ProductImageProgress): number {
  if (progress.total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((progress.processed / progress.total) * 100)));
}
