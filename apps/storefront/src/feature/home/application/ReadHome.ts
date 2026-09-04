import type { StorefrontBootstrap } from '../../../entity/session';
import type { Home } from '../model/Home';
import { projectHome } from '../model/HomeProjection';

export class ReadHome {
  execute(bootstrap: StorefrontBootstrap | undefined): Home | null {
    return projectHome(bootstrap);
  }
}
