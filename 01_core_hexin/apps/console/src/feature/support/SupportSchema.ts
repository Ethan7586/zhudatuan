import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const SupportCaseSchema = z.object({
  id: z.string().min(1), conversation_id: z.string().min(1), priority: z.string().min(1), skill: z.string().min(1),
  state: z.string().min(1), assigned_agent_id: z.string().nullable(), response_due_at: z.string().nullable(),
  resolution_due_at: z.string().nullable(), created_at: z.string().min(1), updated_at: z.string().min(1),
  version: DatabaseIntegerSchema, subject: z.string().min(1), member_id: z.string().nullable().optional(),
  order_id: z.string().nullable(), channel: z.string().min(1),
  order: z.object({ id: z.string().min(1), number: z.string().min(1), state: z.string().min(1), paymentState: z.string().min(1),
    fulfillmentState: z.string().min(1), totalMinor: z.number() }).nullable().optional(),
}).passthrough();
const SupportCaseViewsSchema = z.object({
  handling: DatabaseIntegerSchema,
  review: DatabaseIntegerSchema,
  created: DatabaseIntegerSchema,
  all: DatabaseIntegerSchema,
});
export const SupportCasePageSchema = pageEnvelope(SupportCaseSchema).extend({
  views: SupportCaseViewsSchema.default({ handling: 0, review: 0, created: 0, all: 0 }),
});
export const SupportMessageSchema = z.object({
  id: z.string().min(1), authorType: z.string().min(1), author: z.string().nullable(), body: z.string(), createdAt: z.string().min(1),
  visibility: z.enum(['public', 'internal']).default('public'),
}).passthrough();
export const SupportAttachmentSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf', 'text/plain']),
  size: DatabaseIntegerSchema, visibility: z.enum(['public', 'internal']).default('public'), createdAt: z.string().min(1),
  url: z.string().url().optional(), expiresAt: z.string().optional(),
}).passthrough();
export const SupportMessagePageSchema = pageEnvelope(SupportMessageSchema).extend({
  attachments: z.array(SupportAttachmentSchema).default([]),
});
export const SupportHistorySchema = z.object({
  sequence: DatabaseIntegerSchema, kind: z.string().min(1), actor_id: z.string().nullable(), evidence: z.unknown(),
  occurred_at: z.string().min(1),
}).passthrough();
export const SupportHistoryPageSchema = pageEnvelope(SupportHistorySchema);
export const SupportAgentSchema = z.object({
  id: z.string().min(1), membership_id: z.string().min(1), skills: z.array(z.string()).default([]),
  capacity: DatabaseIntegerSchema, state: z.string().min(1),
}).passthrough();
export const SupportAgentPageSchema = pageEnvelope(SupportAgentSchema);
export type SupportCaseView = 'handling' | 'review' | 'created' | 'all';
export type SupportMessageVisibility = 'public' | 'internal';
export type SupportCase = z.infer<typeof SupportCaseSchema>;
export type SupportMessage = z.infer<typeof SupportMessageSchema>;
export type SupportAttachment = z.infer<typeof SupportAttachmentSchema>;
export type SupportHistory = z.infer<typeof SupportHistorySchema>;
export type SupportAgent = z.infer<typeof SupportAgentSchema>;
