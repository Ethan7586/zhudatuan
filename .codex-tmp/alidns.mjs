import crypto from 'node:crypto';

const [action = 'DescribeDomainRecords', ...pairs] = process.argv.slice(2);
const extra = Object.fromEntries(pairs.map((pair) => {
  const index = pair.indexOf('=');
  if (index < 1) throw new Error(`INVALID_ARGUMENT:${pair}`);
  return [pair.slice(0, index), pair.slice(index + 1)];
}));
const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
if (!accessKeyId || !accessKeySecret) throw new Error('ALIDNS_CREDENTIALS_MISSING');

const encode = (value) => encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const parameters = {
  AccessKeyId: accessKeyId,
  Action: action,
  Format: 'JSON',
  SignatureMethod: 'HMAC-SHA1',
  SignatureNonce: crypto.randomUUID(),
  SignatureVersion: '1.0',
  Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  Version: '2015-01-09',
  ...extra,
};
const canonical = Object.entries(parameters)
  .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
  .map(([key, value]) => `${encode(key)}=${encode(value)}`)
  .join('&');
const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(`GET&%2F&${encode(canonical)}`).digest('base64');
const response = await fetch(`https://alidns.aliyuncs.com/?${canonical}&Signature=${encode(signature)}`);
const body = await response.json();
if (!response.ok || body.Code) {
  console.error(JSON.stringify({ Code: body.Code, Message: body.Message, RequestId: body.RequestId }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(body, null, 2));
}
