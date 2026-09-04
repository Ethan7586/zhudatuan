import {
  createProgram,
  productionSources,
  sourceFileMap,
  testSources,
} from '../check/source.mjs';

export function graphContext() {
  const production = productionSources();
  const tests = testSources();
  const program = createProgram([...production, ...tests]);
  return Object.freeze({
    production: new Set(production),
    tests: new Set(tests),
    sourceFiles: sourceFileMap(program),
  });
}

