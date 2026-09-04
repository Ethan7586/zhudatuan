import { CONSOLE_SCOPE_KINDS } from '@shop/authz';
import { z } from 'zod';

export const ScopeParametersSchema = z.object({
  scopeKind: z.enum(CONSOLE_SCOPE_KINDS),
  scopeId: z.string().min(1).max(255),
});
