import { jobsEnvironment } from '@shop/config/server';
import { createIdentityNotificationJobsRuntime } from '../bootstrap/IdentityNotificationJobsRuntime';

const runtime = await createIdentityNotificationJobsRuntime(jobsEnvironment());
await runtime.close();
process.stdout.write('ZHUDATUAN_IDENTITY_NOTIFICATION_JOBS_READY\n');
