import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { CatalogMediaReplicationResult } from '../../03_application_yingyong/CatalogMediaReplication';
import type { CatalogMediaPersistence } from '../../03_application_yingyong/port/CatalogMediaPersistence';
import type { CatalogMediaPurpose } from '../../03_application_yingyong/port/CatalogMediaObjectStorage';

export class PgCatalogMediaPersistence implements CatalogMediaPersistence {
  async upsertReplicationResult(database: OperationDatabase, result: CatalogMediaReplicationResult): Promise<void> {
    const replicas = result.replicas.map((replica) => ({
      targetId: replica.targetId,
      provider: replica.provider,
      bucket: replica.bucket,
      publicUrl: replica.publicUrl,
      required: replica.required,
      uploadStatus: replica.uploadStatus,
      verificationStatus: replica.verificationStatus,
      error: replica.error,
    }));
    await database.query(`with media as (
      insert into catalog.mediaobject(
        media_id,object_key,sha256,content_type,byte_size,overall_status,created_at,updated_at)
        values($1,$2,$3,$4,$5,$6,clock_timestamp(),clock_timestamp())
        on conflict(media_id) do update set object_key=excluded.object_key,sha256=excluded.sha256,
          content_type=excluded.content_type,byte_size=excluded.byte_size,overall_status=excluded.overall_status,
          updated_at=clock_timestamp()
        returning media_id
      ), replicas as (
        select * from jsonb_to_recordset($7::jsonb) as replica(
          "targetId" text,provider text,bucket text,"publicUrl" text,required boolean,
          "uploadStatus" text,"verificationStatus" text,error text)
      )
      insert into catalog.mediareplica(
        media_id,target_id,provider,bucket,public_url,required,upload_status,verification_status,error,updated_at)
        select media.media_id,replicas."targetId",replicas.provider,replicas.bucket,replicas."publicUrl",
          replicas.required,replicas."uploadStatus",replicas."verificationStatus",replicas.error,clock_timestamp()
        from media cross join replicas
        on conflict(media_id,target_id) do update set provider=excluded.provider,bucket=excluded.bucket,
          public_url=excluded.public_url,required=excluded.required,upload_status=excluded.upload_status,
          verification_status=excluded.verification_status,error=excluded.error,updated_at=clock_timestamp()`,
    [result.mediaId, result.objectKey, result.sha256, result.contentType, result.byteSize, result.overallStatus,
      JSON.stringify(replicas)]);
  }

  async bindProductMedia(
    database: OperationDatabase,
    productId: string,
    mediaId: string,
    purpose: CatalogMediaPurpose,
    position: number,
  ): Promise<void> {
    await database.query(`insert into catalog.productmedia(
      product_id,media_id,purpose,position,state,created_at,updated_at)
      values($1,$2,$3,$4,'ready',clock_timestamp(),clock_timestamp())
      on conflict(product_id,purpose,position) do update set media_id=excluded.media_id,state='ready',updated_at=clock_timestamp()`,
    [productId, mediaId, purpose, position]);
  }

  async unbindProductMedia(
    database: OperationDatabase,
    productId: string,
    purpose: CatalogMediaPurpose,
    position: number,
  ): Promise<void> {
    await database.query('delete from catalog.productmedia where product_id=$1 and purpose=$2 and position=$3',
      [productId, purpose, position]);
  }
}
