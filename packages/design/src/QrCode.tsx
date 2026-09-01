import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

export interface QrCodeProps {
  readonly value: string;
  readonly size?: number;
  readonly label?: string;
  readonly className?: string;
}

export interface QrMatrix {
  readonly modules: readonly (readonly boolean[])[];
  readonly count: number;
  readonly quiet: 4;
}

export function QrCode({ value, size = 232, label = '商城二维码', className }: QrCodeProps) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const pixels = boundedSize(size);
  const extent = matrix.count + matrix.quiet * 2;
  return (
    <svg className={className} width={pixels} height={pixels} viewBox={`0 0 ${extent} ${extent}`} role="img" aria-label={label} shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
      <title>{label}</title>
      <rect width={extent} height={extent} fill="white" />
      <path d={matrixPath(matrix)} fill="black" />
    </svg>
  );
}

export function qrMatrix(value: string): QrMatrix {
  const parsed = validValue(value);
  const code = qrcode(0, 'M');
  code.addData(parsed, 'Byte');
  code.make();
  const count = code.getModuleCount();
  const modules = Array.from({ length: count }, (_, row) => Object.freeze(Array.from({ length: count }, (_, column) => code.isDark(row, column))));
  return Object.freeze({ modules: Object.freeze(modules), count, quiet: 4 as const });
}

function matrixPath(matrix: QrMatrix): string {
  const commands: string[] = [];
  for (let row = 0; row < matrix.count; row += 1) {
    for (let column = 0; column < matrix.count; column += 1) {
      if (matrix.modules[row]?.[column]) commands.push(`M${column + matrix.quiet} ${row + matrix.quiet}h1v1h-1z`);
    }
  }
  return commands.join('');
}

function validValue(value: string): string {
  if (value.length < 1 || value.length > 2048) throw new Error('QRCODE_VALUE_INVALID');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('QRCODE_VALUE_INVALID');
  }
  const secure = parsed.protocol === 'https:';
  const local = parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1';
  if ((!secure && !local) || parsed.username || parsed.password || parsed.hash) throw new Error('QRCODE_VALUE_INVALID');
  return parsed.toString();
}

function boundedSize(value: number): number {
  if (!Number.isSafeInteger(value) || value < 128 || value > 512) throw new Error('QRCODE_SIZE_INVALID');
  return value;
}
