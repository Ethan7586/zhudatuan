import type { NodeManifest } from '@shop/config/server';
import { token } from './Container';

export const NODE_MANIFEST = token<NodeManifest>('runtime.node-manifest');
export const NODE_DATABASE_ROLE = token<string>('runtime.node-database-role');
