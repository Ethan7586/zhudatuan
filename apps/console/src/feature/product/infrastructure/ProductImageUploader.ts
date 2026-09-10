import { createFetchCatalog } from '@shop/sdk/catalog';
import { hashFile } from '@shop/sdk/files';
import { uploadObject } from '@shop/sdk/objects';
import { productImageContentType } from '../model/ProductImagePolicy';
import type { ProductCommand, ProductPort } from '../public';

type Catalog = ReturnType<typeof createFetchCatalog>;
type CommandContext = Parameters<Catalog['mediauploadsCreate']>[1];

export class ProductImageUploader {
  constructor(
    private readonly catalog: Pick<Catalog, 'mediauploadsCreate'>,
    private readonly command: (request: ProductCommand, signal?: AbortSignal) => CommandContext
  ) {}

  async upload(request: ProductCommand, file: File, signal?: AbortSignal, progress?: Parameters<ProductPort['uploadProductImage']>[3]) {
    const contentType = productImageContentType(file);
    const sha256 = await hashFile(file, signal, (processed) => progress?.({ stage: 'checking', processed, total: file.size }));
    const intent = await this.catalog.mediauploadsCreate({ body: { name: file.name, contentType, size: file.size, sha256 } }, this.command(request, signal));
    progress?.({ stage: 'uploading', processed: 0, total: file.size });
    await uploadObject({
      url: intent.upload.url,
      headers: intent.upload.headers,
      body: file,
      ...(progress === undefined ? {} : { progress: (processed: number, total: number) => progress({ stage: 'uploading', processed, total }) }),
      ...(signal === undefined ? {} : { signal }),
    }).catch(() => {
      throw new Error('商品图片上传失败，请检查网络后直接重试；已选择的图片会保留。');
    });
    const { upload: _upload, ...image } = intent;
    return Object.freeze(image);
  }
}
