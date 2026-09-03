import { jobRuntimeProfile, jobsEnvironment } from '@shop/config/server';
import { createPaymentJobsRuntime } from '../bootstrap/PaymentJobsRuntime';

const environment = jobsEnvironment();
if (jobRuntimeProfile(environment) !== 'payment-only') throw new Error('JOB_RUNTIME_PROFILE_INVALID');
const runtime = await createPaymentJobsRuntime(environment);
await runtime.close();
process.stdout.write('ZHUDATUAN_PAYMENT_JOBS_READY\n');
