import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { OperationBodyFor } from '@shop/contract';

type ProductImageContentType = OperationBodyFor<'CatalogMediauploadsCreateInput'>['contentType'];

export const PRODUCT_IMAGE_GUIDANCE = `支持 JPG、JPEG、PNG，单张不超过 ${RUNTIME_LIMITS.upload.maximumImageBytes / 1_048_576} MB。`;

export function productImageContentType(file: Pick<File, 'name' | 'size' | 'type'>): ProductImageContentType {
  const contentType = file.type.toLowerCase();
  const name = file.name.normalize('NFKC').trim().toLowerCase();
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > RUNTIME_LIMITS.upload.maximumImageBytes) throw new Error(`商品图片不可为空且不得超过 ${RUNTIME_LIMITS.upload.maximumImageBytes / 1_048_576} MB。`);
  if (contentType === 'image/png' && name.endsWith('.png')) return 'image/png';
  if (contentType === 'image/jpeg' && (name.endsWith('.jpg') || name.endsWith('.jpeg'))) return 'image/jpeg';
  throw new Error('请选择 JPG、JPEG 或 PNG 格式的商品图片。');
}

export function productImageError(file: Pick<File, 'name' | 'size' | 'type'>): string | undefined {
  try {
    productImageContentType(file);
    return undefined;
  } catch (cause) {
    return cause instanceof Error ? cause.message : '商品图片不符合要求。';
  }
}
