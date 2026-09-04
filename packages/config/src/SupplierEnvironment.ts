import { surfaceClientEnvironment, type SurfaceClientEnvironment } from './ClientEnvironment';
import type { EnvironmentSource } from './Environment';

export function supplierEnvironment(source?: EnvironmentSource): SurfaceClientEnvironment {
  return surfaceClientEnvironment('supplier', source);
}
