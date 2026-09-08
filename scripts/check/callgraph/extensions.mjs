import fs from 'node:fs';
import path from 'node:path';

import { relative, root, ts } from '../source.mjs';
import { literalText, objectProperties, unique, violation } from './catalog.mjs';

const providerRoot = path.join(root, 'extensions/channel');
const catalogFile = path.join(root, 'packages/contract/src/RequirementCatalog.ts');
const registryFile = path.join(root, 'services/commerce/src/modules/extension/infrastructure/loader/ProviderCatalog.ts');
const skeleton = ['Manifest.ts', 'Catalog.ts', 'Factory.ts', 'Config.ts', 'index.ts'];
const directories = ['capability', 'integration'];
const manifestFields = ['id', 'name', 'kind', 'version', 'apiVersion', 'contractVersion', 'capabilities', 'permissions', 'configSchema', 'eventSubscriptions', 'secretRefs', 'sandbox', 'healthOperation', 'webhookContract'];
const resilienceFields = ['rateLimits', 'timeout', 'retryPolicy', 'circuitPolicy'];
const capabilityFile = Object.freeze({
  Catalog: 'ProductSource.ts', Brand: 'ProductSource.ts', Store: 'ProductSource.ts', Menu: 'ProductSource.ts', Option: 'ProductSource.ts', Cinema: 'ProductSource.ts', Show: 'ProductSource.ts', GeoStore: 'ProductSource.ts',
  Price: 'PriceSource.ts', Inventory: 'StockSource.ts', GeoStock: 'StockSource.ts', TimeSlot: 'StockSource.ts', GeoDelivery: 'StockSource.ts',
  Order: 'OrderSubmitter.ts', Issue: 'OrderSubmitter.ts', DirectCharge: 'OrderSubmitter.ts', SeatLock: 'OrderSubmitter.ts', Cancel: 'OrderSubmitter.ts', Void: 'OrderSubmitter.ts', Return: 'OrderSubmitter.ts',
  Logistics: 'OrderSubmitter.ts', Delivery: 'OrderSubmitter.ts', Shipment: 'OrderSubmitter.ts', Pickup: 'OrderSubmitter.ts', Query: 'OrderSubmitter.ts', Verify: 'OrderSubmitter.ts', Bind: 'OrderSubmitter.ts',
  Refund: 'RefundProvider.ts', Extend: 'RefundProvider.ts', Substitute: 'RefundProvider.ts', Statement: 'StatementSource.ts', Webhook: 'WebhookVerifier.ts',
});

function arrayInitializer(sourceFile, variableName) {
  let found;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (ts.isArrayLiteralExpression(initializer)) found = initializer;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function objectInitializer(sourceFile, variableName) {
  let found;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === variableName && node.initializer) {
      const initializer = unwrap(node.initializer);
      if (ts.isObjectLiteralExpression(initializer)) found = initializer;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function unwrap(node) {
  if (ts.isCallExpression(node) && node.arguments.length) return unwrap(node.arguments[0]);
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return unwrap(node.expression);
  return node;
}

function literalArray(node) {
  const value = node && unwrap(node);
  if (!value || !ts.isArrayLiteralExpression(value)) return [];
  return value.elements.map((element) => literalText(element)).filter(Boolean);
}

function catalog(sourceFiles) {
  const values = [];
  const source = sourceFiles.get(catalogFile);
  if (!source) return { entries: [], violations: [violation('PROVIDER_CATALOG_MISSING', relative(catalogFile), 'PROVIDER_CATALOG_RECORDS')] };
  const array = arrayInitializer(source, 'PROVIDER_CATALOG_RECORDS');
  if (!array) return { entries: [], violations: [violation('PROVIDER_CATALOG_INVALID', relative(catalogFile), 'array initializer missing')] };
  const seen = new Set();
  const entries = [];
  for (const [index, element] of array.elements.entries()) {
    if (!ts.isObjectLiteralExpression(element)) {
      values.push(violation('PROVIDER_CATALOG_ENTRY_INVALID', `${relative(catalogFile)}:${index + 1}`, 'object required'));
      continue;
    }
    const properties = objectProperties(element, source);
    const id = literalText(properties.get('id'));
    if (!unique(values, seen, 'PROVIDER_CATALOG', `${relative(catalogFile)}:${index + 1}`, id)) continue;
    const priorityNode = properties.get('priority');
    const priority = priorityNode && ts.isNumericLiteral(priorityNode) ? Number(priorityNode.text) : undefined;
    const delivery = literalText(properties.get('delivery'));
    const vendor = literalText(properties.get('vendor'));
    if (![1, 3, 4].includes(priority)) values.push(violation('PROVIDER_PRIORITY_INVALID', relative(catalogFile), id));
    if (delivery !== (priority === 1 ? 'required' : 'deferred-contract')) values.push(violation('PROVIDER_DELIVERY_INVALID', relative(catalogFile), id));
    entries.push({ id, priority, delivery, vendor });
  }
  if (entries.length !== 20) values.push(violation('PROVIDER_COUNT_INVALID', relative(catalogFile), `expected=20 actual=${entries.length}`));
  if (entries.filter(({ priority }) => priority === 1).length !== 11) values.push(violation('PROVIDER_P1_COUNT_INVALID', relative(catalogFile), 'expected=11'));
  return { entries, violations: values };
}

export function auditExtensions(sourceFiles) {
  const parsed = catalog(sourceFiles);
  const values = [...parsed.violations];
  const registry = sourceFiles.get(registryFile);
  const registryText = registry?.text ?? '';
  if (!registry) values.push(violation('PROVIDER_REGISTRY_MISSING', relative(registryFile), 'explicit factory registry'));
  const required = parsed.entries.filter(({ delivery }) => delivery === 'required');
  for (const entry of required) {
    const directory = path.join(providerRoot, entry.id);
    for (const file of skeleton) {
      const target = path.join(directory, file);
      if (!sourceFiles.has(target)) values.push(violation('PROVIDER_FILE_MISSING', relative(target), entry.id));
    }
    const packageFile = path.join(directory, 'package.json');
    if (!fs.existsSync(packageFile)) values.push(violation('PROVIDER_FILE_MISSING', relative(packageFile), entry.id));
    for (const name of directories) {
      const target = path.join(directory, name);
      if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) values.push(violation('PROVIDER_DIRECTORY_MISSING', relative(target), entry.id));
    }
    for (const retired of ['Provider.ts', 'manifest.ts', 'Client.ts', 'Mapper.ts', 'ErrorMap.ts', 'Health.ts', 'Webhook.ts']) {
      const target = path.join(directory, retired);
      if (fs.readdirSync(directory).includes(retired)) values.push(violation('PROVIDER_RETIRED_FILE_PRESENT', relative(target), entry.id));
    }
    const manifestFile = path.join(directory, 'Manifest.ts');
    const manifestSource = sourceFiles.get(manifestFile);
    const definition = manifestSource && objectInitializer(manifestSource, 'definition');
    if (!manifestSource || !definition) {
      values.push(violation('PROVIDER_MANIFEST_INVALID', relative(manifestFile), entry.id));
    } else {
      const properties = objectProperties(definition, manifestSource);
      for (const field of manifestFields) if (!properties.has(field)) values.push(violation('PROVIDER_FIELD_MISSING', relative(manifestFile), `${entry.id}:${field}`));
      if (properties.has('priority')) values.push(violation('PROVIDER_PRIORITY_DUPLICATED', relative(manifestFile), entry.id));
      if (literalText(properties.get('id')) !== entry.id) values.push(violation('PROVIDER_ID_MISMATCH', relative(manifestFile), entry.id));
      if (!/function\s+manifest\s*\([^)]*signature/.test(manifestSource.text) || !/\bsignature\b/.test(manifestSource.text)) values.push(violation('PROVIDER_SIGNATURE_INJECTION_MISSING', relative(manifestFile), entry.id));
      if (!/\bSTANDARD_PROVIDER_POLICY\b/.test(manifestSource.text) && !resilienceFields.every((field) => properties.has(field))) {
        values.push(violation('PROVIDER_RESILIENCE_POLICY_MISSING', relative(manifestFile), entry.id));
      }
      for (const capability of literalArray(properties.get('capabilities'))) {
        const implementation = capabilityFile[capability];
        if (!implementation) {
          values.push(violation('PROVIDER_CAPABILITY_UNKNOWN', relative(manifestFile), `${entry.id}:${capability}`));
          continue;
        }
        const target = path.join(directory, 'capability', implementation);
        if (!sourceFiles.get(target)?.text.includes('export ')) values.push(violation('PROVIDER_CAPABILITY_IMPLEMENTATION_MISSING', relative(target), `${entry.id}:${capability}`));
      }
    }
    const isLocal = entry.id === 'supplier';
    const integrationFiles = isLocal ? ['Client.ts', 'Mapper.ts', 'ErrorMap.ts'] : ['Client.ts', 'Auth.ts', 'Mapper.ts', 'Signature.ts', 'ErrorMap.ts'];
    for (const file of integrationFiles) {
      const target = path.join(directory, 'integration', file);
      if (!sourceFiles.has(target)) values.push(violation('PROVIDER_INTEGRATION_FILE_MISSING', relative(target), entry.id));
    }
    const catalogSource = sourceFiles.get(path.join(directory, 'Catalog.ts'));
    const catalogDefinition = catalogSource && objectInitializer(catalogSource, entry.id[0].toUpperCase() + entry.id.slice(1) + 'Catalog');
    if (!catalogSource || !catalogDefinition) {
      values.push(violation('PROVIDER_UI_CATALOG_INVALID', relative(path.join(directory, 'Catalog.ts')), entry.id));
    } else {
      const fields = objectProperties(catalogDefinition, catalogSource);
      for (const field of ['id', 'name', 'business', 'clients', 'settings', 'help']) if (!fields.has(field)) values.push(violation('PROVIDER_UI_CATALOG_FIELD_MISSING', relative(path.join(directory, 'Catalog.ts')), `${entry.id}:${field}`));
    }
    const configText = sourceFiles.get(path.join(directory, 'Config.ts'))?.text ?? '';
    if (!configText.includes("@shop/config/provider") || (isLocal ? !configText.includes('strictConfigObject') : !configText.includes('providerConnectionConfig'))) {
      values.push(violation('PROVIDER_TYPED_CONFIG_MISSING', relative(path.join(directory, 'Config.ts')), entry.id));
    }
    const packageDocument = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    const dependencies = Object.keys(packageDocument.dependencies ?? {});
    for (const dependency of ['@shop/config', '@shop/contract', '@shop/providercore']) if (!dependencies.includes(dependency)) values.push(violation('PROVIDER_DEPENDENCY_MISSING', relative(packageFile), `${entry.id}:${dependency}`));
    if (!registryText.includes(`@shop/provider${entry.id}`)) values.push(violation('PROVIDER_NOT_REGISTERED', relative(registryFile), entry.id));
    const testDirectory = path.join(directory, 'test');
    const requiredTests = ['Contract.test.ts', 'Fixture.test.ts', 'Mapping.test.ts', 'Failure.test.ts'];
    const hasTest = fs.existsSync(testDirectory) && requiredTests.every((name) => sourceFiles.has(path.join(testDirectory, name)));
    if (!hasTest) values.push(violation('PROVIDER_CONTRACT_TEST_MISSING', relative(testDirectory), entry.id));
    const tests = hasTest
      ? fs
          .readdirSync(testDirectory)
          .filter((name) => name.endsWith('.test.ts'))
          .map((name) => fs.readFileSync(path.join(testDirectory, name), 'utf8'))
          .join('\n')
      : '';
    if (!tests.includes('assertProviderCapabilities')) values.push(violation('PROVIDER_CAPABILITY_TEST_MISSING', relative(testDirectory), entry.id));
    if (!tests.includes('assertProviderQuality')) values.push(violation('PROVIDER_QUALITY_TEST_MISSING', relative(testDirectory), entry.id));
    if (!tests.includes('@shop/providercore/test')) values.push(violation('PROVIDER_SHARED_CONTRACT_TEST_MISSING', relative(testDirectory), entry.id));
    const factoryText = sourceFiles.get(path.join(directory, 'Factory.ts'))?.text ?? '';
    if (!factoryText.includes('definition') || (entry.id !== 'supplier' && !factoryText.includes('Mapper'))) {
      values.push(violation('PROVIDER_FACTORY_INCOMPLETE', relative(path.join(directory, 'Factory.ts')), entry.id));
    }
    const integrationText = [...sourceFiles.entries()]
      .filter(([file]) => file.startsWith(`${path.join(directory, 'integration')}${path.sep}`))
      .map(([, source]) => source.text)
      .join('\n');
    if (entry.id !== 'supplier' && !/create[A-Za-z]+Client/.test(integrationText)) {
      values.push(violation('PROVIDER_INTEGRATION_CLIENT_MISSING', relative(path.join(directory, 'integration')), entry.id));
    }
    for (const [file, source] of sourceFiles) {
      if (!file.startsWith(`${directory}${path.sep}`)) continue;
      if (/\b(?:DatabasePool|PoolClient|PgUnitOfWork)\b|\b(?:insert|update|delete)\s+(?:catalog|inventory|order|payment|finance)\./i.test(source.text)) {
        values.push(violation('PROVIDER_DATABASE_ACCESS_FORBIDDEN', relative(file), entry.id));
      }
      if (!file.includes(`${path.sep}integration${path.sep}`) && /\.json\s*\(\s*\)/.test(source.text)) {
        values.push(violation('PROVIDER_RAW_RESPONSE_OUTSIDE_INTEGRATION', relative(file), entry.id));
      }
    }
  }
  for (const entry of parsed.entries.filter(({ delivery }) => delivery === 'deferred-contract')) {
    if (fs.existsSync(path.join(providerRoot, entry.id))) values.push(violation('DEFERRED_PROVIDER_CODE_FORBIDDEN', relative(path.join(providerRoot, entry.id)), entry.id));
  }
  const hostProvider = path.join(providerRoot, 'core/src/Provider.ts');
  if (!sourceFiles.get(hostProvider)?.text.includes('health()')) values.push(violation('PROVIDER_HEALTH_MISSING', relative(hostProvider), 'host provider health contract'));
  const executorFile = path.join(providerRoot, 'core/src/RequestExecutor.ts');
  const hostClient = sourceFiles.get(executorFile)?.text ?? '';
  for (const primitive of ['RatePolicy', 'ConcurrencyPolicy', 'CircuitPolicy', 'Deadline', 'retry']) {
    if (!hostClient.includes(primitive)) values.push(violation('PROVIDER_RESILIENCE_PRIMITIVE_MISSING', relative(executorFile), primitive));
  }
  for (const primitive of ['ProviderTelemetry', 'x-trace-id', 'redactProviderValue']) if (!hostClient.includes(primitive)) values.push(violation('PROVIDER_OBSERVABILITY_PRIMITIVE_MISSING', relative(executorFile), primitive));
  for (const file of ['Capability.ts', 'ProviderError.ts', 'ProviderContext.ts', 'RequestExecutor.ts']) {
    const target = path.join(providerRoot, 'core/src', file);
    if (!sourceFiles.has(target)) values.push(violation('PROVIDER_CORE_FILE_MISSING', relative(target), file));
  }
  for (const target of [path.join(providerRoot, 'core/src/ErrorMap.ts'), path.join(providerRoot, 'core/src/integration/Client.ts')]) if (sourceFiles.has(target)) values.push(violation('PROVIDER_CORE_RETIRED_FILE_PRESENT', relative(target), 'retired core compatibility surface'));
  const extensionContract = path.join(providerRoot, 'core/test/ExtensionContract.ts');
  if (!sourceFiles.get(extensionContract)?.text.includes('assertProviderQuality')) values.push(violation('PROVIDER_EXTENSION_CONTRACT_MISSING', relative(extensionContract), 'shared extension contract'));
  const coreSources = [...sourceFiles.entries()].filter(([file]) => file.startsWith(`${path.join(providerRoot, 'core')}${path.sep}`));
  for (const [file, source] of coreSources) {
    if (/\bif\s*\([^)]*provider\s*===?\s*['"]/i.test(source.text)) values.push(violation('PROVIDER_BRANCH_IN_CORE', relative(file), 'provider-specific branch'));
  }
  for (const retired of ['extensions/providers', 'extensions/vendors']) {
    const target = path.join(root, retired);
    if (fs.existsSync(target)) values.push(violation('PROVIDER_RETIRED_DIRECTORY_PRESENT', relative(target), retired));
  }
  const expectedCoreUsers = Object.freeze({ jdcore: ['jdproduct', 'jdfresh'], cakecore: ['cake', 'flower', 'foodvoucher', 'meal'], wanliancore: ['charge', 'movie'] });
  for (const [core, expected] of Object.entries(expectedCoreUsers)) {
    const dependency = '@shop/provider' + core;
    const actual = required.filter(({ id }) => {
      const packageFile = path.join(providerRoot, id, 'package.json');
      return fs.existsSync(packageFile) && Object.hasOwn(JSON.parse(fs.readFileSync(packageFile, 'utf8')).dependencies ?? {}, dependency);
    }).map(({ id }) => id);
    if (actual.sort().join(',') !== [...expected].sort().join(',')) values.push(violation('PROVIDER_CORE_USAGE_INVALID', relative(path.join(providerRoot, core)), `expected=${expected.join(',')} actual=${actual.join(',')}`));
  }
  for (const retired of ['bookcore', 'tmallcore']) {
    const target = path.join(providerRoot, retired);
    if (fs.existsSync(target)) values.push(violation('PROVIDER_FOLDED_CORE_PRESENT', relative(target), retired));
  }
  const notificationRoot = path.join(root, 'extensions/notification');
  for (const name of ['inapp', 'sms', 'email', 'wechat']) {
    const directory = path.join(notificationRoot, name);
    for (const file of ['Manifest.ts', 'Catalog.ts', 'Factory.ts', 'Config.ts', 'Client.ts', 'Health.ts', 'index.ts']) {
      const target = path.join(directory, 'src', file);
      if (!sourceFiles.has(target)) values.push(violation('NOTIFICATION_EXTENSION_FILE_MISSING', relative(target), name));
    }
    const manifest = sourceFiles.get(path.join(directory, 'src/Manifest.ts'))?.text ?? '';
    for (const field of ['capabilities', 'configSchema', 'secretRefs', 'healthOperation']) {
      if (!manifest.includes(field)) values.push(violation('NOTIFICATION_MANIFEST_FIELD_MISSING', relative(path.join(directory, 'src/Manifest.ts')), `${name}:${field}`));
    }
    if (name !== 'inapp') {
      for (const field of ['permissions', 'rateLimits', 'timeout', 'retryPolicy', 'circuitPolicy']) {
        if (!manifest.includes(field)) values.push(violation('NOTIFICATION_RESILIENCE_POLICY_MISSING', relative(path.join(directory, 'src/Manifest.ts')), `${name}:${field}`));
      }
    }
    const packageFile = path.join(directory, 'package.json');
    if (!fs.existsSync(packageFile)) {
      values.push(violation('NOTIFICATION_PACKAGE_MISSING', relative(packageFile), name));
    } else {
      const dependencies = Object.keys(JSON.parse(fs.readFileSync(packageFile, 'utf8')).dependencies ?? {});
      if (!dependencies.includes('@shop/contract')) values.push(violation('NOTIFICATION_DEPENDENCY_MISSING', relative(packageFile), `${name}:@shop/contract`));
      if (name !== 'inapp' && !dependencies.includes('@shop/kernel')) values.push(violation('NOTIFICATION_DEPENDENCY_MISSING', relative(packageFile), `${name}:@shop/kernel`));
    }
    const tests = [...sourceFiles.entries()].filter(([file]) => file.startsWith(`${path.join(directory, 'src')}${path.sep}`) && file.endsWith('.test.ts')).map(([, source]) => source.text).join('\n');
    if (!tests.includes('signal')) values.push(violation('NOTIFICATION_CANCELLATION_TEST_MISSING', relative(directory), name));
    if (name !== 'inapp' && !tests.includes('trace')) values.push(violation('NOTIFICATION_TRACE_TEST_MISSING', relative(directory), name));
  }
  const paymentDirectory = path.join(root, 'extensions/payment/wechat');
  for (const file of ['Manifest.ts', 'Factory.ts', 'Config.ts', 'Gateway.ts', 'Signature.ts', 'Notification.ts', 'index.ts']) {
    const target = path.join(paymentDirectory, 'src', file);
    if (!sourceFiles.has(target)) values.push(violation('PAYMENT_EXTENSION_FILE_MISSING', relative(target), file));
  }
  const paymentManifest = sourceFiles.get(path.join(paymentDirectory, 'src/Manifest.ts'))?.text ?? '';
  for (const field of ['operations', 'capabilities', 'configSchema', 'secretRefs', 'permissions', 'rateLimits', 'timeout', 'retryPolicy', 'circuitPolicy', 'healthOperation', 'webhook']) {
    if (!paymentManifest.includes(field)) values.push(violation('PAYMENT_MANIFEST_FIELD_MISSING', relative(path.join(paymentDirectory, 'src/Manifest.ts')), field));
  }
  for (const operation of ['Create', 'Query', 'Close', 'Refund', 'Webhook']) if (!paymentManifest.includes(`'${operation}'`)) values.push(violation('PAYMENT_OPERATION_MISSING', relative(path.join(paymentDirectory, 'src/Manifest.ts')), operation));
  const paymentGateway = sourceFiles.get(path.join(paymentDirectory, 'src/Gateway.ts'))?.text ?? '';
  for (const criterion of ['PaymentExecutionContext', 'execution.signal', 'execution.deadline', 'requestId', 'traceId']) {
    if (!paymentGateway.includes(criterion)) values.push(violation('PAYMENT_EXECUTION_CONTEXT_MISSING', relative(path.join(paymentDirectory, 'src/Gateway.ts')), criterion));
  }
  const paymentTests = [...sourceFiles.entries()].filter(([file]) => file.startsWith(`${path.join(paymentDirectory, 'src')}${path.sep}`) && file.endsWith('.test.ts')).map(([, source]) => source.text).join('\n');
  for (const criterion of ['WECHAT_PAY_REQUEST_CANCELLED', 'x-trace-id', 'stringMatching(/[\\u3400-\\u9fff]/u)']) {
    if (!paymentTests.includes(criterion)) values.push(violation('PAYMENT_FAULT_TEST_MISSING', relative(paymentDirectory), criterion));
  }
  const paymentPackage = path.join(paymentDirectory, 'package.json');
  if (!fs.existsSync(paymentPackage)) values.push(violation('PAYMENT_PACKAGE_MISSING', relative(paymentPackage), 'wechat'));
  else {
    const dependencies = Object.keys(JSON.parse(fs.readFileSync(paymentPackage, 'utf8')).dependencies ?? {});
    for (const dependency of ['@shop/config', '@shop/contract', '@shop/kernel']) if (!dependencies.includes(dependency)) values.push(violation('PAYMENT_DEPENDENCY_MISSING', relative(paymentPackage), dependency));
  }
  const retiredPaymentGateway = path.join(root, 'services/commerce/src/modules/payment/infrastructure/adapter/WechatGateway.ts');
  if (sourceFiles.has(retiredPaymentGateway) || fs.existsSync(retiredPaymentGateway)) values.push(violation('PAYMENT_RUNTIME_ADAPTER_PRESENT', relative(retiredPaymentGateway), 'move gateway into payment extension'));
  const runtime = sourceFiles.get(path.join(root, 'services/commerce/src/composition/Application.ts'))?.text ?? '';
  for (const retired of ['AliyunSmsChannel', 'InappChannel']) {
    if (runtime.includes(retired)) values.push(violation('NOTIFICATION_RUNTIME_ADAPTER_PRESENT', relative(path.join(root, 'services/commerce/src/composition/Application.ts')), retired));
  }
  for (const factory of ['WechatPaymentFactory', 'SmsFactory', 'InappFactory', 'EmailFactory', 'WechatFactory']) {
    if (!runtime.includes(factory)) values.push(violation('EXTENSION_RUNTIME_FACTORY_MISSING', relative(path.join(root, 'services/commerce/src/composition/Application.ts')), factory));
  }
  const executorTest = sourceFiles.get(path.join(providerRoot, 'core/test/RequestExecutor.test.ts'))?.text ?? '';
  for (const criterion of ['PROVIDER_CONNECTION_TIMEOUT', 'PROVIDER_REQUEST_CANCELLED', 'x-trace-id', 'redacts secrets']) {
    if (!executorTest.includes(criterion)) values.push(violation('EXTENSION_FAULT_TEST_MISSING', relative(path.join(providerRoot, 'core/test/RequestExecutor.test.ts')), criterion));
  }
  const registryTest = sourceFiles.get(path.join(root, 'services/commerce/src/composition/ExtensionRegistry.test.ts'))?.text ?? '';
  for (const criterion of ['rotation canary', 'in-flight work to drain', 'product, order and finance capabilities']) {
    if (!registryTest.includes(criterion)) values.push(violation('EXTENSION_LIFECYCLE_TEST_MISSING', relative(path.join(root, 'services/commerce/src/composition/ExtensionRegistry.test.ts')), criterion));
  }
  const webhookTest = sourceFiles.get(path.join(root, 'services/commerce/src/modules/channel/test/ApplyChannelWebhook.test.ts'))?.text ?? '';
  for (const criterion of ['deduplicates a replay', 'unknown external mapping', 'task has already been cancelled']) {
    if (!webhookTest.includes(criterion)) values.push(violation('EXTENSION_WEBHOOK_TEST_MISSING', relative(path.join(root, 'services/commerce/src/modules/channel/test/ApplyChannelWebhook.test.ts')), criterion));
  }
  const channelModelTest = sourceFiles.get(path.join(root, 'services/commerce/src/modules/channel/test/ChannelModel.test.ts'))?.text ?? '';
  for (const criterion of ["webhookTransition(completed, 'processing')", "requireReplay(unknown)"]) {
    if (!channelModelTest.includes(criterion)) values.push(violation('EXTENSION_RECOVERY_TEST_MISSING', relative(path.join(root, 'services/commerce/src/modules/channel/test/ChannelModel.test.ts')), criterion));
  }
  const deliveryRegistryTest = sourceFiles.get(path.join(root, 'services/commerce/src/modules/notification/infrastructure/registry/DeliveryRegistry.test.ts'))?.text ?? '';
  if (!deliveryRegistryTest.includes('in-flight delivery') || !deliveryRegistryTest.includes("disable('primary'")) {
    values.push(violation('NOTIFICATION_DRAIN_TEST_MISSING', relative(path.join(root, 'services/commerce/src/modules/notification/infrastructure/registry/DeliveryRegistry.test.ts')), 'provider drain and fallback'));
  }
  const testExtensions = path.join(root, 'scripts/testextensions.mjs');
  if (!fs.existsSync(testExtensions)) values.push(violation('EXTENSION_TEST_RUNNER_MISSING', relative(testExtensions), 'all extension packages'));
  const extensionModuleFile = path.join(root, 'services/commerce/src/modules/extension/Module.ts');
  const extensionLoaderFile = path.join(root, 'services/commerce/src/modules/extension/infrastructure/loader/RuntimeExtensionLoader.ts');
  const extensionBootstrapFile = path.join(root, 'services/commerce/src/modules/extension/infrastructure/loader/ExtensionBootstrap.ts');
  const extensionBootstrap = sourceFiles.get(extensionBootstrapFile)?.text ?? '';
  if (!extensionBootstrap.includes('extensionCatalog') || !extensionBootstrap.includes('extensionLoader') || !extensionBootstrap.includes("./RuntimeExtensionLoader")) {
    values.push(violation('EXTENSION_LOADER_COMPOSITION_MISSING', relative(extensionBootstrapFile), 'Extension bootstrap must own both loader modes'));
  }
  for (const [file, source] of sourceFiles) {
    if (!file.startsWith(`${path.join(root, 'services/commerce/src')}${path.sep}`)) continue;
    if (file !== registryFile && /from\s+['"]@shop\/provider(?!core\b)[a-z]+['"]/.test(source.text)) {
      values.push(violation('PROVIDER_PACKAGE_IMPORT_OUTSIDE_CATALOG', relative(file), 'concrete provider package'));
    }
    if (file !== registryFile && !file.endsWith('.test.ts') && /\b(?:if|switch)\s*\([^)]*(?:provider|channel)[^)]*\)[\s\S]{0,120}['"](?:jdproduct|jdfresh|tmall|supplier|cake|flower|book|charge|foodvoucher|movie|meal)['"]/i.test(source.text)) {
      values.push(violation('PROVIDER_BUSINESS_BRANCH_FORBIDDEN', relative(file), 'provider-specific business branch'));
    }
    if (file !== extensionLoaderFile && file !== extensionBootstrapFile && !file.endsWith('.test.ts') && /from\s+['"][^'"]*RuntimeExtensionLoader['"]/.test(source.text)) {
      values.push(violation('EXTENSION_LOADER_COMPOSITION_BYPASSED', relative(file), 'import through Extension bootstrap'));
    }
  }
  return values;
}
