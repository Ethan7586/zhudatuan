export function contrastRatio(foreground: string, background: string): number {
  const brighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (brighter + 0.05) / (darker + 0.05);
}

export function meetsContrast(foreground: string, background: string, large = false): boolean {
  return contrastRatio(foreground, background) >= (large ? 3 : 4.5);
}

function luminance(value: string): number {
  if (!/^#[\da-f]{6}$/i.test(value)) throw new Error('CONTRAST_COLOR_INVALID');
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  return channels.reduce((total, channel, index) => total + transform(channel) * [0.2126, 0.7152, 0.0722][index]!, 0);
}

function transform(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}
