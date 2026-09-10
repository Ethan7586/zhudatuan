import { LazyModule } from '@shop/kernel';

export const storefrontDependencies = new LazyModule(() => import('./Dependencies'));
