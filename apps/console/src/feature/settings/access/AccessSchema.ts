import { z } from 'zod';
import { DatabaseIntegerSchema } from '../../../shared/schema/DatabaseInteger';
import { pageEnvelope } from '../../../shared/schema/PageEnvelope';

export const AccessMembershipSchema = z
  .object({
    id: z.string().min(1),
    display_name: z.string().min(1),
    employee_no: z.string().nullable(),
    mobile_masked: z.string().nullable(),
    client: z.string().min(1),
    status: z.string().min(1),
    access_version: DatabaseIntegerSchema,
    roles: z.array(z.object({ role: z.string().min(1), name: z.string().min(1), kind: z.enum(['custom', 'system', 'owner']), version: DatabaseIntegerSchema, allows: z.array(z.string()), denies: z.array(z.string()) })),
    scopes: z.array(z.object({ id: z.string().min(1), kind: z.string().min(1), scope: z.string().min(1), effect: z.enum(['allow', 'deny']), expires: z.string().nullable() })),
    overrides: z.array(z.object({ permission: z.string().min(1), effect: z.enum(['allow', 'deny']), expires: z.string().nullable() })),
  })
  .strict();
export const AccessPageSchema = pageEnvelope(AccessMembershipSchema);
export type AccessMembership = z.infer<typeof AccessMembershipSchema>;
