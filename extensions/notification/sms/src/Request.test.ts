import { describe, expect, it } from 'vitest';
import { createAliyunRequest } from './Request';

describe('AliyunSmsRequest', () => {
  it('creates the deterministic ACS3 signed form request without exposing the secret', () => {
    const request = createAliyunRequest(
      'dysmsapi.aliyuncs.com',
      { phoneNumbers: '13900000000', signName: '商城', templateCode: 'SMS_1234', templateParam: '{"code":"123456"}', outId: 'acceptance-1' },
      { accessKeyId: 'test-key-id', accessKeySecret: 'test-key-secret' },
      new Date('2026-08-31T08:00:00Z'),
      '11111111-2222-4333-8444-555555555555'
    );
    expect(request.url).toBe('https://dysmsapi.aliyuncs.com/');
    expect(request.body).toBe('PhoneNumbers=13900000000&SignName=%E5%95%86%E5%9F%8E&TemplateCode=SMS_1234&TemplateParam=%7B%22code%22%3A%22123456%22%7D&OutId=acceptance-1');
    expect(request.headers.authorization).toBe(
      'ACS3-HMAC-SHA256 Credential=test-key-id,SignedHeaders=content-type;host;x-acs-action;x-acs-content-sha256;x-acs-date;x-acs-signature-nonce;x-acs-version,Signature=4d2c6ac32736d22d77d9fff8e255c0746d6df65b7eb3e05742a53bfb2c36b4f6'
    );
    expect(JSON.stringify(request)).not.toContain('test-key-secret');
  });

  it('signs the temporary security token when ECS credentials are used', () => {
    const request = createAliyunRequest(
      'dysmsapi.aliyuncs.com',
      { phoneNumbers: '13900000000', signName: '商城', templateCode: 'SMS_1234', templateParam: '{}', outId: 'acceptance-2' },
      { accessKeyId: 'temporary-key', accessKeySecret: 'temporary-secret', securityToken: 'temporary-token' },
      new Date('2026-08-31T08:00:00Z'),
      '66666666-7777-4888-8999-000000000000'
    );
    expect(request.headers['x-acs-security-token']).toBe('temporary-token');
    expect(request.headers.authorization).toContain('x-acs-security-token');
  });
});
