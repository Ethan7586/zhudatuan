import { useMemo } from 'react';

export interface BarcodeProps {
  readonly value: string;
  readonly label?: string;
  readonly height?: number;
  readonly className?: string;
}

export function Barcode({ value, label = '会员条形码', height = 72, className }: BarcodeProps) {
  const bars = useMemo(() => code128Bars(value), [value]);
  const pixels = boundedHeight(height);
  return (
    <svg className={className} width="100%" height={pixels} viewBox={`0 0 ${bars.width} ${pixels}`} preserveAspectRatio="none" role="img" aria-label={label} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <title>{label}</title>
      <rect width={bars.width} height={pixels} fill="white" />
      <path d={bars.path} fill="black" />
    </svg>
  );
}

export function code128Bars(value: string): Readonly<{ path: string; width: number }> {
  if (value.length < 1 || value.length > 128 || !/^[\x20-\x7e]+$/.test(value)) throw new Error('BARCODE_VALUE_INVALID');
  const data = Array.from(value, (character) => character.charCodeAt(0) - 32);
  const checksum = (104 + data.reduce((sum, code, index) => sum + code * (index + 1), 0)) % 103;
  const codes = [104, ...data, checksum, 106];
  const quiet = 10;
  let x = quiet;
  const rectangles: string[] = [];
  for (const code of codes) {
    const pattern = PATTERNS[code];
    if (!pattern) throw new Error('BARCODE_PATTERN_INVALID');
    for (let index = 0; index < pattern.length; index += 1) {
      const width = Number(pattern[index]);
      if (index % 2 === 0) rectangles.push(`M${x} 0h${width}v64h-${width}z`);
      x += width;
    }
  }
  return Object.freeze({ path: rectangles.join(''), width: x + quiet });
}

function boundedHeight(value: number): number {
  if (!Number.isSafeInteger(value) || value < 48 || value > 160) throw new Error('BARCODE_HEIGHT_INVALID');
  return value;
}

const PATTERNS = Object.freeze([
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232','2331112',
] as const);
