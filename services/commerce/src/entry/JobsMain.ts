import { jobsEnvironment } from '@shop/config/server';
import { runJobs } from './JobsEntrypoint';

await runJobs(jobsEnvironment());
