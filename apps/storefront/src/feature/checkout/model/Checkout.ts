import type { Quote } from './Quote';

export interface Checkout {
  readonly quote: Quote | null;
  readonly status: 'idle' | 'quoted' | 'committing';
}
