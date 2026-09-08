import { token } from '../../../../composition/Container';
export interface NavigationClock {
  now(): Date;
}
export const NAVIGATION_CLOCK = token<NavigationClock>('navigation.clock');
