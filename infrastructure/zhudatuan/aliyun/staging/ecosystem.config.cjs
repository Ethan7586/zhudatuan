'use strict';

const releaseRoot = '/opt/zhudatuan-staging/current';
const sharedRoot = '/opt/zhudatuan-staging/shared';
const logRoot = '/var/log/zhudatuan-staging';
const environmentFile = `${sharedRoot}/.env.staging`;

const runtime = Object.freeze({
  cwd: releaseRoot,
  node_args: [`--env-file=${environmentFile}`],
  interpreter: '/usr/bin/node',
  instances: 1,
  exec_mode: 'fork',
  autorestart: true,
  restart_delay: 5_000,
  max_restarts: 10,
  min_uptime: '30s',
  max_memory_restart: '1G',
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  merge_logs: true,
  env: {
    NODE_ENV: 'production',
    APP_ENV: 'production',
    DEPLOYMENT_ENV: 'staging',
  },
});

module.exports = {
  apps: [
    {
      ...runtime,
      name: 'zhudatuan-staging-api',
      script: 'services/commerce/dist/ApiMain.js',
      kill_timeout: 45_000,
      env: {
        ...runtime.env,
        API_PORT: '3101',
      },
      error_file: `${logRoot}/api-error.log`,
      out_file: `${logRoot}/api-out.log`,
    },
    {
      ...runtime,
      name: 'zhudatuan-staging-jobs',
      script: 'services/commerce/dist/JobsMain.js',
      kill_timeout: 130_000,
      error_file: `${logRoot}/jobs-error.log`,
      out_file: `${logRoot}/jobs-out.log`,
    },
  ],
};
