import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const webSource = ['apps/{auth,console,store,supplier,storefront}/src/**/*.{ts,tsx}'];
const sharedSource = [
  'packages/{authz,config,contract,design,kernel,sdk,telemetry}/src/**/*.{ts,tsx}',
  'packages/testing/src/browser/**/*.{ts,tsx}',
];
const browserTests = ['tests/browser/**/*.ts', 'playwright.config.ts'];
const typedSource = [...webSource, ...sharedSource, ...browserTests];
const reactSource = [
  ...webSource,
  'packages/design/src/**/*.{ts,tsx}',
  'packages/testing/src/browser/**/*.{ts,tsx}',
];
const jsxSource = [
  'apps/{auth,console,store,supplier,storefront}/src/**/*.tsx',
  'packages/design/src/**/*.tsx',
  'packages/testing/src/browser/**/*.tsx',
];
const miniappSource = ['apps/miniapp/miniprogram/**/*.js'];
const nodeTests = ['apps/miniapp/tests/**/*.cjs', 'tests/browser/**/*.mjs', 'eslint.config.mjs'];

const typeAwareRules = Object.assign({}, ...tseslint.configs.recommendedTypeChecked.map((config) => config.rules ?? {}));
const reactHookRules = {
  'react-hooks/exhaustive-deps': 'error',
  'react-hooks/rules-of-hooks': 'error',
};
const accessibilityRules = jsxA11y.flatConfigs.recommended.rules;

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/storybook-static/**',
    '**/tmp/**',
    '**/*.generated.ts',
    'packages/contract/src/RequirementCatalog.generated.ts',
    'packages/contract/src/events/CommerceEvents.ts',
    'packages/contract/src/operations/CommerceOperations.ts',
    'packages/contract/src/operations/CommerceSchemas.ts',
    'apps/miniapp/miniprogram/api/operations.js',
  ]),
  {
    name: 'typed frontend correctness',
    files: typedSource,
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: { allowDefaultProject: ['playwright.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...eslint.configs.recommended.rules,
      ...typeAwareRules,
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/only-throw-error': ['error', { allow: [{ from: 'lib', name: 'Response' }] }],
    },
  },
  {
    name: 'react hooks',
    files: reactSource,
    plugins: { 'react-hooks': reactHooks },
    rules: reactHookRules,
  },
  {
    name: 'jsx accessibility',
    files: jsxSource,
    plugins: { 'jsx-a11y': jsxA11y },
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: accessibilityRules,
  },
  {
    name: 'miniapp source',
    files: miniappSource,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.es2021,
        App: 'readonly',
        AbortController: 'readonly',
        Component: 'readonly',
        Page: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        wx: 'readonly',
      },
    },
    rules: eslint.configs.recommended.rules,
  },
  {
    name: 'miniapp node tests',
    files: ['apps/miniapp/tests/**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, wx: 'writable' } },
    rules: eslint.configs.recommended.rules,
  },
  {
    name: 'frontend node configuration',
    files: nodeTests.filter((file) => !file.includes('miniapp/tests')),
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: eslint.configs.recommended.rules,
  },
]);
