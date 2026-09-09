import { int, literal, positive, record, regex, strictObject, string } from 'zod/mini';
import { isoUtc, unsigned } from './Primitives';

export const ImageContentTypeSchema = literal(['image/jpeg', 'image/png']);

export const ObjectUploadAuthorizationSchema = strictObject({
  url: string(),
  method: literal('PUT'),
  headers: record(string(), string()),
  expiresAt: isoUtc,
});

const imageAssetFields = {
  reference: string(),
  path: string(),
  sha256: string().check(regex(/^[a-f0-9]{64}$/)),
  size: unsigned,
  contentType: ImageContentTypeSchema,
  retentionUntil: isoUtc,
} as const;

export const ImageAssetInputSchema = strictObject(imageAssetFields);
export const ImageAssetUploadInputSchema = strictObject({ name: string(), contentType: ImageContentTypeSchema, size: int().check(positive()), sha256: string().check(regex(/^[a-f0-9]{64}$/)) });
export const ImageAssetUploadOutputSchema = strictObject({ ...imageAssetFields, upload: ObjectUploadAuthorizationSchema });
