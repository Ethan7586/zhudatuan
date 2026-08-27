module.exports = {
  apps: [
    {
      name: 'zhudatuan-storefront',
      cwd: '/opt/zhudatuan/current/apps/storefront-web',
      script: '/opt/zhudatuan/current/node_modules/vinext/dist/cli.js',
<<<<<<< HEAD
      args: 'start --hostname 127.0.0.1 --port 4310',
      node_args: ['--env-file=/opt/zhudatuan/shared/storefront.env'],
      interpreter: '/usr/bin/node',
      env: {
        NODE_ENV: 'production',
        PORT: '4310',
=======
      args: 'start',
      node_args: ['--env-file=/opt/zhudatuan/shared/.env.production'],
      interpreter: '/usr/bin/node',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)
        APP_ENV: 'production',
        AUTH_MODE: 'membership',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '/var/log/pm2/zhudatuan-storefront-error.log',
      out_file: '/var/log/pm2/zhudatuan-storefront-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
<<<<<<< HEAD
=======
    {
      name: 'zhudatuan-api',
      cwd: '/opt/zhudatuan/current',
      script: 'services/commerce/dist/ApiMain.js',
      node_args: ['--env-file=/opt/zhudatuan/shared/.env.production'],
      interpreter: '/usr/bin/node',
      env: {
        NODE_ENV: 'production',
        API_PORT: '3001',
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      restart_delay: 3000,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '/var/log/pm2/zhudatuan-api-error.log',
      out_file: '/var/log/pm2/zhudatuan-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
>>>>>>> e29ce3d6 (fix: lock owner-approved zhudatuan UI baseline)
  ],
};
