import type { ProductKind } from '../model/Product';

export function mapProductKind(value: string, category: string): ProductKind {
  const normalized = category.toLowerCase();
  if (value === 'physical') return normalized.includes('supermarket') ? 'supermarket' : 'physical';
  if (value === 'voucher') return 'virtual_coupon';
  if (normalized.includes('movie')) return 'movie_ticket';
  if (normalized.includes('nearby') || normalized.includes('store')) return 'nearby_store';
  if (value === 'service') return 'life_service';
  return 'unknown';
}
