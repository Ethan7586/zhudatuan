export function storefrontImageUrl(source: string, width: number): string {
  try {
    const url = new URL(source);
    if (url.hostname !== 'images.unsplash.com') return source;
    url.searchParams.set('w', String(Math.round(width)));
    url.searchParams.set('q', '72');
    url.searchParams.set('auto', 'format');
    url.searchParams.set('fit', 'crop');
    return url.toString();
  } catch {
    return source;
  }
}
