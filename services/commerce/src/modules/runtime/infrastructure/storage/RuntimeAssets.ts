import { RUNTIME_LIMITS } from '@shop/config/runtime';
import type { AssetPort, AssetUploadRecord, AssetUploadRequest } from '../../public/AssetPort';
import type { ObjectStore } from '../../public/ObjectPort';
import { UploadSession } from './UploadSession';

export class RuntimeAssets implements AssetPort {
  private readonly uploads: UploadSession;

  constructor(private readonly objects: ObjectStore) {
    this.uploads = new UploadSession(objects);
  }

  async authorize(request: AssetUploadRequest): Promise<AssetUploadRecord> {
    const record = await this.uploads.authorize({ ...request, category: 'asset', retentionDays: RUNTIME_LIMITS.upload.retentionDays.catalog });
    return record as AssetUploadRecord;
  }

  verify(record: Omit<AssetUploadRecord, 'upload'>) {
    return this.uploads.verify(record);
  }

  link(reference: string) {
    return this.objects.authorize(reference, RUNTIME_LIMITS.upload.maximumAuthorizationSeconds);
  }
}
