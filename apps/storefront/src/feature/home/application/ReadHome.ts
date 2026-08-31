import type { OperationOutputFor } from '@shop/contract';
import type { Home } from '../model/Home';
import { mapHome } from '../infrastructure/HomeMapper';

export class ReadHome {
  execute(bootstrap: OperationOutputFor<'storefront.bootstrap.read'> | undefined): Home | null {
    return mapHome(bootstrap);
  }
}
