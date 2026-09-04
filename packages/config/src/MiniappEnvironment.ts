import { surfaceClientEnvironment, type SurfaceClientEnvironment } from './ClientEnvironment';
import type { EnvironmentSource } from './Environment';

export function miniappEnvironment(source?: EnvironmentSource): SurfaceClientEnvironment {
  return surfaceClientEnvironment('miniapp', source);
}
