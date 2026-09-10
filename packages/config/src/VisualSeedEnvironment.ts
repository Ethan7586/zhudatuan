import { processEnvironment, type EnvironmentSource } from './Environment';
import { localSeedEnvironment, type LocalSeedEnvironment } from './LocalEnvironment';
import { absoluteDirectory } from './PathEnvironment';

export const VISUAL_SEED_ENVIRONMENT_KEYS = Object.freeze({ acceptanceAssetDirectory: 'ACCEPTANCE_ASSET_DIRECTORY' } as const);

export interface VisualSeedEnvironment extends LocalSeedEnvironment {
  readonly acceptanceAssetDirectory: string;
}

export function visualSeedEnvironment(source: EnvironmentSource = processEnvironment()): VisualSeedEnvironment {
  return Object.freeze({
    ...localSeedEnvironment(source),
    acceptanceAssetDirectory: absoluteDirectory(source.ACCEPTANCE_ASSET_DIRECTORY, 'ACCEPTANCE_ASSET_DIRECTORY_INVALID'),
  });
}
