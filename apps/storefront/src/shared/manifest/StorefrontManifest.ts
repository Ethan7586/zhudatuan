import type { ComponentType } from 'react';
import type { RouteId } from '../../generated/RouteBinding';

export interface RouteModule {
  readonly Component: ComponentType;
}
export interface StorefrontRoute {
  readonly routeid: RouteId;
  readonly protected: boolean;
  readonly load: () => Promise<RouteModule>;
}
export interface StorefrontManifest {
  readonly feature: string;
  readonly routes: readonly StorefrontRoute[];
}
export function defineManifest(manifest: StorefrontManifest): StorefrontManifest {
  return Object.freeze({ ...manifest, routes: Object.freeze([...manifest.routes]) });
}
