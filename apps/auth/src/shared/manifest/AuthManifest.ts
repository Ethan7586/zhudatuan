import type { RouteId } from '../../generated/RouteBinding';
import type { ComponentType } from 'react';

export interface AuthRouteModule { readonly Component: ComponentType }
export interface AuthManifest { readonly routeid: RouteId; readonly load: () => Promise<AuthRouteModule> }
export function defineManifest(manifest: AuthManifest): AuthManifest { return Object.freeze(manifest); }
