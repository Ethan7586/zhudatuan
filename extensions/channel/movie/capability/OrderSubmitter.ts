export const MovieOrderSubmitter = Object.freeze({ order: 'movie.order.submit', cancel: 'movie.order.cancel', verification: 'movie.verify' });

export function validateSeatLock(lock: Readonly<{ expiresAt: string; quotedMinor: number }>, checkoutMinor: number, now = Date.now()): void {
  const expiresAt = Date.parse(lock.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) throw new Error('MOVIE_SEAT_LOCK_EXPIRED');
  if (!Number.isSafeInteger(checkoutMinor) || checkoutMinor < 0 || checkoutMinor !== lock.quotedMinor) throw new Error('MOVIE_PRICE_DRIFT');
}
