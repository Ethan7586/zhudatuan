import { SCOPE_KINDS } from '@shop/authz';
import { z } from 'zod';
import { COMPONENT_KEYS } from '../../generated/NavigationBinding';

export interface NavigationNode {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly route: string;
  readonly component: (typeof COMPONENT_KEYS)[number];
  readonly order: number;
  readonly entry: string;
  readonly disabled: boolean;
  readonly children: readonly NavigationNode[];
}

export const NavigationNodeSchema: z.ZodType<NavigationNode> = z.lazy(() =>
  z.object({
    id: z.string().regex(/^[a-z][a-z0-9]*$/),
    title: z.string().min(1),
    icon: z.string().min(1),
    route: z.string().startsWith('/'),
    component: z.enum(COMPONENT_KEYS),
    order: z.number().int().nonnegative(),
    entry: z.string().min(1),
    disabled: z.boolean(),
    children: z.array(NavigationNodeSchema),
  })
);

export const NavigationTreeSchema = z.object({
  scope: z.object({ id: z.string().min(1), kind: z.enum(SCOPE_KINDS) }),
  target: z.literal('console'),
  version: z.string().min(1),
  etag: z.string().min(1),
  generatedAt: z.string().min(1),
  catalogVersion: z.string().min(1),
  nodes: z.array(NavigationNodeSchema).min(1),
});

export type NavigationTree = z.infer<typeof NavigationTreeSchema>;
