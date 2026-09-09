import type { AssetPort, AssetUploadRecord } from '../../../runtime/public';
import { DomainError } from '../../../../platform/error/DomainError';

export type ProductImage = Omit<AssetUploadRecord, 'upload'>;

export class ProductMedia {
  constructor(private readonly assets: AssetPort) {}

  async verify(image: ProductImage | null | undefined): Promise<string | null | undefined> {
    if (image === undefined || image === null) return image;
    try {
      const metadata = await this.assets.verify(image);
      if (
        metadata.reference !== image.reference ||
        metadata.path !== image.path ||
        metadata.sha256 !== image.sha256 ||
        metadata.size !== image.size ||
        metadata.contentType !== image.contentType ||
        metadata.retentionUntil !== image.retentionUntil ||
        (metadata.contentType !== 'image/jpeg' && metadata.contentType !== 'image/png')
      ) {
        throw new Error('CATALOG_IMAGE_INVALID');
      }
      return metadata.reference;
    } catch (cause) {
      if (cause instanceof DomainError) throw cause;
      throw new DomainError('VALIDATION_FAILED', { field: 'image' });
    }
  }

  async links(references: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const unique = [...new Set(references.filter((reference) => reference !== ''))];
    const linked = await Promise.allSettled(unique.map(async (reference) => [reference, (await this.assets.link(reference)).url] as const));
    return new Map(linked.flatMap((item) => (item.status === 'fulfilled' ? [item.value] : [])));
  }
}

export function productImage(value: unknown): ProductImage {
  return value as ProductImage;
}
