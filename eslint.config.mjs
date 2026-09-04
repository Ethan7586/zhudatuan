import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const webSource = ['apps/{auth,console,storefront}/src/**/*.{ts,tsx}'];
const sharedSource = ['packages/{authz,config,contract,design,kernel,sdk,telemetry}/src/**/*.{ts,tsx}', 'packages/testing/src/browser/**/*.{ts,tsx}'];
const browserTests = ['tests/browser/**/*.ts', 'playwright.config.ts'];
const typedSource = [...webSource, ...sharedSource, ...browserTests];
const reactSource = [...webSource, 'packages/design/src/**/*.{ts,tsx}', 'packages/testing/src/browser/**/*.{ts,tsx}'];
const jsxSource = ['apps/{auth,console,storefront}/src/**/*.tsx', 'packages/design/src/**/*.tsx', 'packages/testing/src/browser/**/*.tsx'];
const nodeTests = ['tests/browser/**/*.mjs', 'eslint.config.mjs'];
const viewSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/{view,ui}/**/*.{ts,tsx}'];
const viewModelSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/viewmodel/**/*.{ts,tsx}'];
const applicationSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/application/**/*.{ts,tsx}'];
const modelSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/model/**/*.{ts,tsx}'];
const publicSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/public/**/*.{ts,tsx}'];
const infrastructureSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/infrastructure/**/*.{ts,tsx}'];
const routeSource = ['apps/{auth,console,storefront}/src/{feature,entity}/**/route/**/*.{ts,tsx}'];
const layerTestIgnores = ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'];

const typeAwareRules = Object.assign({}, ...tseslint.configs.recommendedTypeChecked.map((config) => config.rules ?? {}));
const reactHookRules = {
  'react-hooks/exhaustive-deps': 'error',
  'react-hooks/rules-of-hooks': 'error',
};
const accessibilityRules = jsxA11y.flatConfigs.recommended.rules;
const restrictedImports = (paths, patterns, message) => [
  'error',
  {
    paths: paths.map((name) => ({ name, message })),
    patterns: patterns.map((group) => ({ group: [group], message })),
  },
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/coverage/**',
    '**/storybook-static/**',
    '**/tmp/**',
    '**/*.generated.ts',
    'packages/contract/src/RequirementCatalog.ts',
    'packages/contract/src/events/CommerceEvents.ts',
    'packages/contract/src/operations/CommerceCatalog.ts',
    'packages/contract/src/operations/CommerceSchemas.ts',
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
    rules: {
      ...accessibilityRules,
      'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['tabpanel', 'region'] }],
    },
  },
  {
    name: 'pure views',
    files: viewSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports(
        ['@shop/sdk', '@tanstack/react-query', 'react-router', 'react-router-dom'],
        ['@shop/sdk/*', '@tanstack/react-query/*', 'react-router/*', 'react-router-dom/*', '**/infrastructure/**'],
        'View 只能消费 ViewModel 状态和纯展示依赖。'
      ),
    },
  },
  {
    name: 'viewmodel boundaries',
    files: viewModelSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports([], ['**/infrastructure/**'], 'ViewModel 必须通过 Application 和 Public Port 获取能力。'),
    },
  },
  {
    name: 'application boundaries',
    files: applicationSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports(
        ['react', '@shop/sdk', '@tanstack/react-query', 'react-router', 'react-router-dom'],
        ['react/*', '@shop/sdk/*', '@tanstack/react-query/*', 'react-router/*', 'react-router-dom/*', '**/infrastructure/**'],
        'Application 只能编排 Model 与 Public Port。'
      ),
    },
  },
  {
    name: 'model boundaries',
    files: modelSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports(
        ['react', '@shop/sdk', '@tanstack/react-query', 'react-router', 'react-router-dom'],
        ['react/*', '@shop/sdk/*', '@tanstack/react-query/*', 'react-router/*', 'react-router-dom/*', '**/infrastructure/**'],
        'Model 必须保持框架和传输层无关。'
      ),
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'indexedDB'],
    },
  },
  {
    name: 'public contract boundaries',
    files: publicSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports(['@shop/sdk', '@tanstack/react-query'], ['@shop/sdk/*', '@tanstack/react-query/*', '**/infrastructure/**', '**/viewmodel/**'], 'Public 只公开稳定端口，不暴露查询、传输或内部实现。'),
    },
  },
  {
    name: 'infrastructure boundaries',
    files: infrastructureSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports([], ['**/view/**', '**/ui/**', '**/viewmodel/**', '**/route/**'], 'Infrastructure 不得反向依赖界面层。'),
    },
  },
  {
    name: 'route composition boundaries',
    files: routeSource,
    ignores: layerTestIgnores,
    rules: {
      'no-restricted-imports': restrictedImports(['@shop/sdk', '@tanstack/react-query'], ['@shop/sdk/*', '@tanstack/react-query/*', '**/infrastructure/**', '**/*Gateway'], 'Route 只负责参数、守卫、依赖和 ViewModel 装配。'),
    },
  },
  {
    name: 'frontend node configuration',
    files: nodeTests,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: eslint.configs.recommended.rules,
  },
]);
