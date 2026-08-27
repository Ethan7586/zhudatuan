module.exports = {
  apps: [
    {
      name: 'smart-wing-core-read-cache',
      cwd: '/opt/smart-wing',
      script: 'services/core-read-cache/dist/server.mjs',
      node_args: ['--env-file=/opt/smart-wing/.env.production'],
      interpreter: '/usr/bin/node',
      env: { NODE_ENV: 'production', APP_ENV: 'production', CORE_READ_CACHE_PORT: '3002' },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '/var/log/pm2/smart-wing-core-cache-error.log',
      out_file: '/var/log/pm2/smart-wing-core-cache-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
