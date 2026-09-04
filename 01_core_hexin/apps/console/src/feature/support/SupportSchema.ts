import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const SupportCaseSchema = z.object({
  id: z.string().min(1), conversation_id: z.string().min(1), priority: z.string().min(1), skill: z.string().min(1),
  state: z.string().min(1), assigned_agent_id: z.string().nullable(), response_due_at: z.string().nullable(),
  resolution_due_at: z.string().nullable(), created_at: z.string().min(1), updated_at: z.string().min(1),
  version: DatabaseIntegerSchema, subject: z.string().min(1), member_id: z.string().nullable().optional(),
  order_id: z.string().nullable(), channel: z.string().min(1),
}).passthrough();
export const SupportCasePageSchema = pageEnvelope(SupportCaseSchema);
export const SupportMessageSchema = z.object({
  id: z.string().min(1), authorType: z.string().min(1), author: z.string().nullable(), body: z.string(), createdAt: z.string().min(1),
}).passthrough();
export const SupportMessagePageSchema = pageEnvelope(SupportMessageSchema).extend({ attachments: z.array(z.unknown()).optional() });
export type SupportCase = z.infer<typeof SupportCaseSchema>;
export type SupportMessage = z.infer<typeof SupportMessageSchema>;
