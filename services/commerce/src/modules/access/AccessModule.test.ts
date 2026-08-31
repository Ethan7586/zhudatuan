import { describe, expect, it } from 'vitest';
import type { Token } from '../../bootstrap/Container';
import type { ModuleContext, PublicPortToken } from '../../bootstrap/ModuleRegistry';
import { OrganizationPort } from '../organization/OrganizationPort';
import { PartnerPort } from '../partner/PartnerPort';
import { ACCESS_ORGANIZATION_PORT } from '../organization/public';
import { ACCESS_PARTNER_PORT } from '../partner/public';
import { AccessModule } from './AccessModule';

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
      ports: {
        get<T>(token: PublicPortToken<T>): T {
          if (token === ACCESS_ORGANIZATION_PORT) return new OrganizationPort() as T;
          if (token === ACCESS_PARTNER_PORT) return new PartnerPort() as T;
          throw new Error(`PORT_UNEXPECTED:${token.key}`);
        },
      },
      service,
    };

    expect(AccessModule.bind(context)).toHaveLength(7);
    expect(serviceCalls).toBe(0);
  });
});
