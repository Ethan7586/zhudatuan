import { describe, expect, it } from 'vitest';
import type { Token } from '../../../composition/Container';
import type { ModuleContext, PublicPortToken } from '../../../composition/ModuleRegistry';
import { AccessModule } from '../Module';
import { IDENTITY_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT, TASK_AUTHORIZATION_PORT } from '../public';

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

    expect(AccessModule.bind(context).map((binding) => binding.token)).toEqual([IDENTITY_ACCESS_PORT, MEMBER_IMPORT_ACCESS_PORT, TASK_AUTHORIZATION_PORT]);
    expect(serviceCalls).toBe(0);
  });
});
