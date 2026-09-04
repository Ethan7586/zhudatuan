import { describe,expect,it } from 'vitest';
import { Installation } from '../../02_domain_yewu/model/Installation';

describe('Installation',()=>{
  it('enforces the canary lifecycle without compatibility transitions',()=>{
    const disabled=new Installation('connection:1','private','1.0.0','mall:1','disabled',0);
    const testing=disabled.transition('testing'); const enabled=testing.transition('enabled');
    expect([testing.state,testing.version,enabled.state,enabled.version]).toEqual(['testing',1,'enabled',2]);
    expect(()=>disabled.transition('enabled')).toThrow('EXTENSION_STATE_INVALID:disabled:enabled');
    expect(()=>enabled.transition('testing')).toThrow('EXTENSION_STATE_INVALID:enabled:testing');
  });
});
