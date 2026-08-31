import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../shared/schema/PageEnvelope';

export const SupportCaseSchema = z
  .object({
    id: z.string().min(1),
    conversation_id: z.string().min(1),
    priority: z.string().min(1),
    skill: z.string().min(1),
    state: z.string().min(1),
    assigned_agent_id: z.string().nullable(),
    response_due_at: z.string().nullable(),
    resolution_due_at: z.string().nullable(),
    created_at: z.string().min(1),
    updated_at: z.string().min(1),
    version: DatabaseIntegerSchema,
    subject: z.string().min(1),
    order_id: z.string().nullable(),
    channel: z.string().min(1),
  })
  .passthrough();
export const SupportCasePageSchema = pageEnvelope(SupportCaseSchema);
export const SupportMessageSchema = z
  .object({
    id: z.string().min(1),
    authorType: z.string().min(1),
    author: z.string().nullable(),
    body: z.string(),
    createdAt: z.string().min(1),
  })
  .passthrough();
export const SupportMessagePageSchema = pageEnvelope(SupportMessageSchema).extend({ attachments: z.array(z.unknown()).optional() });
export const SupportAgentPageSchema = pageEnvelope(z.object({ id: z.string(), membership_id: z.string(), skills: z.array(z.string()), capacity: DatabaseIntegerSchema, state: z.string() }));
export const SupportAccountPageSchema = pageEnvelope(z.object({ id: z.string(), channel: z.string(), external_ref: z.string(), state: z.string(), version: DatabaseIntegerSchema }));
export const SupportRulePageSchema = pageEnvelope(
  z.object({ id: z.string(), name: z.string(), skill: z.string(), priorities: z.array(z.string()), weight: DatabaseIntegerSchema, state: z.string(), version: DatabaseIntegerSchema, updated_at: z.string() })
);
export const SupportSlaPageSchema = pageEnvelope(z.object({ id: z.string(), priority: z.string(), response_seconds: DatabaseIntegerSchema, resolution_seconds: DatabaseIntegerSchema, version: DatabaseIntegerSchema }));
export const SupportHistoryPageSchema = pageEnvelope(z.object({ sequence: DatabaseIntegerSchema, cursor_id: z.string(), kind: z.string(), actor_id: z.string(), evidence: z.unknown(), occurred_at: z.string() }));
export type SupportCase = z.infer<typeof SupportCaseSchema>;
export type SupportMessage = z.infer<typeof SupportMessageSchema>;
export type SupportHistory = z.infer<typeof SupportHistoryPageSchema>['items'][number];
