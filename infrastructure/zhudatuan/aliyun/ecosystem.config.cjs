module.exports = {
  apps: [
    {
      name: 'zhudatuan-storefront',
      cwd: '/opt/zhudatuan/current/apps/storefront-web',
      script: '/opt/zhudatuan/current/node_modules/vinext/dist/cli.js',
      args: 'start --hostname 127.0.0.1 --port 4310',
      node_args: ['--env-file=/opt/zhudatuan/shared/storefront.env'],
      interpreter: '/usr/bin/node',
      env: {
        NODE_ENV: 'production',
        PORT: '4310',
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
  ],
};
