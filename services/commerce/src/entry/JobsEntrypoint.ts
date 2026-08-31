import { jobRuntimeProfile, type JobsEnvironment } from '@shop/config/server';

export interface JobsProfileRunners {
  readonly full: (environment: JobsEnvironment) => Promise<void>;
  readonly identityNotificationOnly: (environment: JobsEnvironment) => Promise<void>;
}

const defaultRunners: JobsProfileRunners = Object.freeze({
  full: async (environment: JobsEnvironment) => (await import('./FullJobsMain')).runFullJobs(environment),
  identityNotificationOnly: async (environment: JobsEnvironment) =>
    (await import('./IdentityNotificationJobsMain')).runIdentityNotificationJobs(environment),
});

export async function runJobs(environment: JobsEnvironment, runners: JobsProfileRunners = defaultRunners): Promise<void> {
  const profile = jobRuntimeProfile(environment);
  if (profile === 'identity-notification-only') return runners.identityNotificationOnly(environment);
  return runners.full(environment);
}
