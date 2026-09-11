export interface ConsoleStaticTransferStep {
  readonly label: 'assets' | 'entry';
  readonly command: 'rsync';
  readonly args: readonly string[];
}

export function createConsoleStaticTransferPlan(
  dist: string,
  host: string,
  productionDirectory: string,
): readonly ConsoleStaticTransferStep[] {
  const remote = `${host}:${productionDirectory}`;
  return Object.freeze([
    Object.freeze({
      label: 'assets' as const,
      command: 'rsync' as const,
      args: Object.freeze(['--archive', '--compress', `${dist}/assets/`, `${remote}/assets/`]),
    }),
    Object.freeze({
      label: 'entry' as const,
      command: 'rsync' as const,
      args: Object.freeze(['--archive', '--compress', '--exclude', 'assets/', `${dist}/`, `${remote}/`]),
    }),
  ]);
}
