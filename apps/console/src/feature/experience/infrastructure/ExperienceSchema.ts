import { z } from 'zod';
import { parseStorefrontEntryUrl, parseStorefrontHandle } from '@shop/contract';
import { ContractJsonValueSchema } from '@shop/contract/schema';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';
import { appConfig } from '../../../shared/config/AppConfig';
import { STOREFRONT_ENTRY_PATH } from '@shop/config/client';

const HandleSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{2,47}$/);
const BaseEntrySchema = z.object({ handle: HandleSchema, url: z.string().url() }).strict();
const EntrySchema = z.discriminatedUnion('state', [
  BaseEntrySchema.extend({ state: z.literal('ready'), releaseId: z.string().min(1), releaseVersion: z.string().min(1), contentHash: z.string().min(1) }).strict(),
  BaseEntrySchema.extend({ state: z.literal('unpublished') }).strict(),
  BaseEntrySchema.extend({ state: z.literal('disabled') }).strict(),
  BaseEntrySchema.extend({ state: z.literal('invalid'), requestId: z.string().min(1) }).strict(),
]);

export const ExperienceSchema = z
  .object({
    id: z.string().min(1),
    mallId: z.string().min(1),
    code: z.string().min(1),
    publicSlug: HandleSchema,
    name: z.string().min(1),
    status: z.enum(['draft', 'active', 'disabled']),
    version: z.number().int().nonnegative(),
    headSequence: z.number().int().nonnegative().nullable(),
    publishedSequence: z.number().int().nonnegative().nullable(),
    entry: EntrySchema,
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    try {
      parseStorefrontEntryUrl(value.entry.url, appConfig.storefrontOrigin, STOREFRONT_ENTRY_PATH, parseStorefrontHandle(value.entry.handle));
    } catch {
      context.addIssue({ code: 'custom', path: ['entry', 'url'], message: 'STOREFRONT_ENTRY_URL_INVALID' });
    }
    if (value.entry.handle !== value.publicSlug) context.addIssue({ code: 'custom', path: ['entry', 'handle'], message: 'STOREFRONT_ENTRY_HANDLE_MISMATCH' });
  });

const DocumentSchema = z
  .object({
    version: z.literal(2),
    application: z.string(),
    pages: z.array(z.object({ id: z.string(), path: z.string(), blocks: z.array(z.object({ id: z.string(), component: z.enum(['hero', 'notice', 'shortcut', 'productcollection', 'richtext']), content: z.record(z.string(), ContractJsonValueSchema), action: z.optional(z.object({ type: z.enum(['link', 'product', 'category', 'collection', 'exchangeableproduct', 'micropage', 'marketingactivity']), target: z.string() }).strict()) }).strict()) }).strict()),
  })
  .strict();
export const ExperienceVersionSchema = z
  .object({
    id: z.string(),
    application_id: z.string(),
    sequence: z.number().int(),
    schema_version: z.literal('2'),
    configuration: DocumentSchema,
    configuration_hash: z.string(),
    validation_state: z.enum(['pending', 'valid', 'invalid']),
    reason: z.string(),
    created_by: z.string(),
    created_at: z.string().datetime(),
  })
  .strict();
const HistorySchema = z
  .object({
    id: z.string(),
    sequence: z.number().int(),
    schemaVersion: z.literal('2'),
    validationState: z.enum(['pending', 'valid', 'invalid']),
    reason: z.string(),
    createdAt: z.string().datetime(),
    lifecycle: z.enum(['published', 'draft']),
  })
  .strict();

export const ExperienceDetailSchema = ExperienceSchema.extend({ head: ExperienceVersionSchema.nullable(), published: ExperienceVersionSchema.nullable(), history: z.array(HistorySchema).max(20) }).strict();
export const ExperiencePageSchema = pageEnvelope(ExperienceSchema);
export const ExperienceCopySchema = ExperienceSchema.extend({ versionId: z.string().min(1) }).strict();
export const ExperienceValidationSchema = z.object({ id: z.string(), application_id: z.string(), validation_state: z.enum(['valid', 'invalid']) }).strict();
export const ExperiencePublicationSchema = z.object({
  id: z.string(), application_id: z.string(), version_id: z.string(), pool_id: z.string(), state: z.enum(['scheduled', 'active', 'retired', 'failed']),
  effective_at: z.string().datetime(), retired_at: z.string().datetime().nullable(), published_by: z.string(),
}).strict();
