import type { Bootstrap, LoginMethod } from '../../bootstrap';
import type { Provider } from '../../federation';

export interface ProviderCatalog {
  readonly credentials: readonly LoginMethod[];
  readonly federations: readonly Provider[];
}

export function providerCatalog(methods: Bootstrap['methods'], providers: readonly Provider[]): ProviderCatalog {
  const credentials = methods.filter((method): method is LoginMethod => method !== 'federation');
  const federations = methods.includes('federation') ? providers : [];
  return Object.freeze({ credentials: Object.freeze(credentials), federations: Object.freeze([...federations]) });
}
