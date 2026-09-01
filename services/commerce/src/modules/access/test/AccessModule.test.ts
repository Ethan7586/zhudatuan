import { describe, expect, it } from 'vitest';
import type { Token } from '../../../bootstrap/Container';
import type { ModuleContext, PublicPortToken } from '../../../bootstrap/ModuleRegistry';
import { AccessModule } from '../Module';

describe('AccessModule', () => {
  it('binds job ports without constructing API operations or requesting API database workloads', () => {
    let serviceCalls = 0;
    const service = <T>(_token: Token<T>): T => {
      serviceCalls += 1;
      throw new Error('JOB_API_SERVICE_FORBIDDEN');
    };
    const context: ModuleContext = {
      workload: 'jobs',
      handlers: {} as ModuleContext['handlers'],
      events: { add: () => undefined },
      ports: {
        get<T>(token: PublicPortToken<T>): T {
          throw new Error(`PORT_UNEXPECTED:${token.key}`);
        },
      },
      service,
    };

    expect(AccessModule.bind(context)).toHaveLength(2);
    expect(serviceCalls).toBe(0);
  });
});
