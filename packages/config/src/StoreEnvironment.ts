import { surfaceClientEnvironment, type SurfaceClientEnvironment } from './ClientEnvironment';
import type { EnvironmentSource } from './Environment';

export function storeEnvironment(source?: EnvironmentSource): SurfaceClientEnvironment {
  return surfaceClientEnvironment('store', source);
}
