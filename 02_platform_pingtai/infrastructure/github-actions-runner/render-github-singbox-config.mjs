#!/usr/bin/env node

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function port(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error(`${name} must be a TCP port`);
  return value;
}

const config = {
  log: { level: 'warn', timestamp: true },
  inbounds: [
    {
      type: 'mixed',
      tag: 'github-local',
      listen: '127.0.0.1',
      listen_port: port('ZDT_GITHUB_LINE_LISTEN_PORT', 7890),
    },
  ],
  outbounds: [
    {
      type: 'shadowsocks',
      tag: 'github-line',
      server: required('ZDT_GITHUB_LINE_SERVER'),
      server_port: port('ZDT_GITHUB_LINE_SERVER_PORT'),
      method: process.env.ZDT_GITHUB_LINE_METHOD ?? 'aes-128-gcm',
      password: required('ZDT_GITHUB_LINE_PASSWORD'),
    },
    { type: 'direct', tag: 'direct' },
  ],
  route: {
    rules: [
      {
        domain_suffix: ['github.com', 'githubusercontent.com', 'githubassets.com', 'ghcr.io'],
        action: 'route',
        outbound: 'github-line',
      },
    ],
    final: 'direct',
  },
};

process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
