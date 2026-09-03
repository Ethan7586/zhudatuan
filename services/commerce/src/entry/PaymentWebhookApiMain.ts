import { paymentWebhookApiEnvironment, paymentWebhookApiPort } from '@shop/config/server';
import { bootstrapApi } from '../bootstrap/ApiBootstrap';
import {
  createPaymentWebhookApiRuntime,
  PAYMENT_WEBHOOK_OPERATION_IDS,
  PaymentWebhookApiModule,
} from '../bootstrap/PaymentWebhookApiRuntime';
import { listen } from '../foundation/interface/NodeServer';

const environment = paymentWebhookApiEnvironment();
const runtime = await createPaymentWebhookApiRuntime(environment);
const bootstrapped = await bootstrapApi({
  modules: [PaymentWebhookApiModule],
  operationIds: PAYMENT_WEBHOOK_OPERATION_IDS,
  extensions: runtime.extensions,
  configure: runtime.configure,
  allowedOrigins: [],
  telemetry: runtime.telemetry,
});
const server = listen(bootstrapped.app, paymentWebhookApiPort(environment), '127.0.0.1');

for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, async () => {
  await server.close();
  await runtime.close();
  process.exit(0);
});
