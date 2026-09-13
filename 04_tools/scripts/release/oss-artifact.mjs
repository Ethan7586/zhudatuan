#!/usr/bin/env node

import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
      fail(`Invalid argument near ${key ?? '<end>'}`);
    }
    options[key.slice(2)] = value;
  }
  return { command, options };
}

function requireValue(value, name) {
  if (!value) fail(`Missing ${name}`);
  return value;
}

function credentials() {
  return {
    accessKeyId: requireValue(process.env.ALIYUN_OSS_ACCESS_KEY_ID, 'ALIYUN_OSS_ACCESS_KEY_ID'),
    accessKeySecret: requireValue(process.env.ALIYUN_OSS_ACCESS_KEY_SECRET, 'ALIYUN_OSS_ACCESS_KEY_SECRET'),
    bucket: requireValue(process.env.ALIYUN_OSS_BUCKET, 'ALIYUN_OSS_BUCKET'),
    endpoint: requireValue(process.env.ALIYUN_OSS_ENDPOINT, 'ALIYUN_OSS_ENDPOINT')
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, ''),
  };
}

function objectUrl({ bucket, endpoint }, object) {
  const encodedObject = object.split('/').map(encodeURIComponent).join('/');
  return new URL(`https://${bucket}.${endpoint}/${encodedObject}`);
}

function signature(secret, value) {
  return createHmac('sha1', secret).update(value).digest('base64');
}

async function upload(options) {
  const file = requireValue(options.file, '--file');
  const object = requireValue(options.object, '--object');
  const contentType = options['content-type'] || 'application/octet-stream';
  const auth = credentials();
  const body = await readFile(file);
  const date = new Date().toUTCString();
  const canonicalResource = `/${auth.bucket}/${object}`;
  const stringToSign = `PUT\n\n${contentType}\n${date}\n${canonicalResource}`;
  const authorization = `OSS ${auth.accessKeyId}:${signature(auth.accessKeySecret, stringToSign)}`;
  const response = await fetch(objectUrl(auth, object), {
    method: 'PUT',
    headers: {
      Authorization: authorization,
      'Content-Length': String(body.length),
      'Content-Type': contentType,
      Date: date,
    },
    body,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    fail(`OSS upload failed: HTTP ${response.status} ${detail}`);
  }
  process.stdout.write(`${object}\n`);
}

function signGet(options) {
  const object = requireValue(options.object, '--object');
  const ttl = Number(options.ttl || '900');
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 3600) {
    fail('--ttl must be an integer between 60 and 3600 seconds');
  }
  const auth = credentials();
  const expires = Math.floor(Date.now() / 1000) + ttl;
  const canonicalResource = `/${auth.bucket}/${object}`;
  const stringToSign = `GET\n\n\n${expires}\n${canonicalResource}`;
  const url = objectUrl(auth, object);
  url.searchParams.set('OSSAccessKeyId', auth.accessKeyId);
  url.searchParams.set('Expires', String(expires));
  url.searchParams.set('Signature', signature(auth.accessKeySecret, stringToSign));
  process.stdout.write(`${url.toString()}\n`);
}

const { command, options } = parseArgs(process.argv.slice(2));
if (command === 'upload') {
  await upload(options);
} else if (command === 'sign-get') {
  signGet(options);
} else {
  fail('Usage: oss-artifact.mjs <upload|sign-get> [options]');
}
