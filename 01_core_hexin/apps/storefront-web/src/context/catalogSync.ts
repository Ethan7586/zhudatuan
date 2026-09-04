import type { ApiProduct } from '../services/productionApi';

/** Resolves public-versus-member catalog precedence for one sync generation. */
export function createCatalogPublisher(isCurrent: () => boolean, publish: (items: ApiProduct[]) => void) {
  let publicCommitted = false;
  let qualifiedCommitted = false;

  return {
    commitPublic(items: ApiProduct[]) {
      if (!isCurrent() || qualifiedCommitted) return false;
      publicCommitted = true;
      publish(items);
      return true;
    },
    commitQualified(items: ApiProduct[]) {
      if (!isCurrent()) return false;
      qualifiedCommitted = true;
      publish(items);
      return true;
    },
    hasPublicFallback() {
      return publicCommitted;
    },
  };
}
