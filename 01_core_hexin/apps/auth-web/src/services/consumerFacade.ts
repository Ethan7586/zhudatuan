const CONSUMER_ACCOUNT_MOUNT = '/accounts';

type ConsumerFacadeLocation = Readonly<Pick<Location, 'origin' | 'pathname'>>;

/** Returns the same-origin L1 façade only while auth-web is mounted below /accounts. */
export function resolveConsumerFacadeOrigin(location: ConsumerFacadeLocation | undefined): string | undefined {
  if (!location || (location.pathname !== CONSUMER_ACCOUNT_MOUNT && !location.pathname.startsWith(`${CONSUMER_ACCOUNT_MOUNT}/`))) {
    return undefined;
  }
  return new URL(location.origin).origin;
}

export function runtimeConsumerFacadeOrigin(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  return resolveConsumerFacadeOrigin(window.location);
}
