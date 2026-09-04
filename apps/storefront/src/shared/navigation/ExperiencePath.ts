import type { ExperienceAction, ExperienceDocument } from '@shop/contract';
import { experiencePath } from '../../entity/session/model/PublishedExperience';
import { routePath, ROUTES } from '../../generated/RouteBinding';

export function experienceActionPath(document: ExperienceDocument, action: ExperienceAction): string | null {
  if (action.type === 'link') return experiencePath(action.target);
  if (action.type === 'product') return routePath('storeproduct', { productId: action.target });
  if (action.type === 'category') return `${ROUTES.storecatalog}?category=${encodeURIComponent(action.target)}`;
  if (action.type === 'micropage') return experiencePath(document.pages.find(({ id }) => id === action.target)?.path ?? '');
  if (action.type === 'exchangeableproduct') return `${ROUTES.storecatalog}?account=welfare`;
  return action.type === 'collection' || action.type === 'marketingactivity' ? ROUTES.storecatalog : null;
}
