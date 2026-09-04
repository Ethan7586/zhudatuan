import { expect, it } from 'vitest';
import { deviceViewModel } from './DeviceViewModel';
it('binds devices', () => expect(deviceViewModel.routes).toEqual(['storedevices']));
