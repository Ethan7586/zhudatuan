'use strict';

const releaseRoot = '/opt/zhudatuan-staging-full/current';
const sharedRoot = '/opt/zhudatuan-staging-full/shared';
const logRoot = '/var/log/zhudatuan-staging-full';
const apiEnvironmentFile = `${sharedRoot}/full-identity-registration-api.env`;
const jobsEnvironmentFile = `${sharedRoot}/full-jobs.env`;

const runtime = Object.freeze({
  cwd: releaseRoot,
  script: '/usr/bin/env',
  interpreter: 'none',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  restart_delay: 5_000,
  max_restarts: 10,
  min_uptime: '30s',
  max_memory_restart: '1G',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
});

const isolatedNode = (environment, environmentFile, entrypoint) => ['-i', 'PATH=/usr/bin:/bin', 'NODE_ENV=production', ...environment, '/usr/bin/node', `--env-file=${environmentFile}`, entrypoint];

module.exports = {
  apps: [
    {
      ...runtime,
      name: 'zhudatuan-staging-full-identity-api',
      args: isolatedNode(
        ['APP_ENV=test', 'AUTH_MODE=membership', 'IDENTITY_REGISTRATION_API_PROFILE=registration-only', 'API_PORT=4431', 'API_BIND_HOST=127.0.0.1'],
        apiEnvironmentFile,
        'services/commerce/dist/IdentityRegistrationApiMain.js'
      ),
      kill_timeout: 45_000,
      error_file: `${logRoot}/identity-api-error.log`,
      out_file: `${logRoot}/identity-api-out.log`,
    },
    {
      ...runtime,
      name: 'zhudatuan-staging-full-jobs',
      args: isolatedNode(['APP_ENV=production', 'JOB_RUNTIME_PROFILE=full'], jobsEnvironmentFile, 'services/commerce/dist/JobsMain.js'),
      kill_timeout: 45_000,
      error_file: `${logRoot}/jobs-error.log`,
      out_file: `${logRoot}/jobs-out.log`,
    },
  ],
};
