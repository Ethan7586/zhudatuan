import { jobRuntimeProfile, jobsEnvironment } from '@shop/config/server';
import { runPaymentJobs } from './PaymentJobsMain';

const environment = jobsEnvironment();
if (jobRuntimeProfile(environment) !== 'payment-only') throw new Error('JOB_RUNTIME_PROFILE_INVALID');
await runPaymentJobs(environment);
