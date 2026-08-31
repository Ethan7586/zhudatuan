import { smokeEnvironment } from '@shop/config/server';
import { HealthProbe } from '../foundation/http/HealthProbe';

const environment = smokeEnvironment();
const health = new HealthProbe(environment.baseUrl, environment.release);
for (const probe of ['live', 'startup', 'ready'] as const) await health.verify(probe);
console.log(`release smoke passed: ${environment.release}`);
