import { jobsEnvironment } from '@shop/config/server';
import { runIdentityNotificationJobs } from './IdentityNotificationJobsMain';

const environment = jobsEnvironment();
if (environment.JOB_RUNTIME_PROFILE !== 'identity-notification-only') throw new Error('JOB_RUNTIME_PROFILE_INVALID');
await runIdentityNotificationJobs(environment);
