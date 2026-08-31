import { describe, expect, it } from 'vitest';
import { NetworkPolicy, publicAddress } from './NetworkPolicy';

describe('NetworkPolicy', () => {
  it('rejects private, metadata, loopback and rebinding answers', async () => {
    const policy = new NetworkPolicy({ hosts: ['provider.example'] }, () => Promise.resolve(['203.0.113.10', '169.254.169.254']));
    await expect(policy.assert('https://provider.example/token')).rejects.toThrow('NETWORK_ADDRESS_DENIED');
    expect(publicAddress('10.0.0.1')).toBe(false);
    expect(publicAddress('::1')).toBe(false);
  });
  it('requires an allowlisted HTTPS endpoint', async () => {
    const policy = new NetworkPolicy({ hosts: ['provider.example'] }, () => Promise.resolve(['8.8.8.8']));
    await expect(policy.assert('https://provider.example/token')).resolves.toBeInstanceOf(URL);
    await expect(policy.assert('https://other.example/token')).rejects.toThrow('NETWORK_ENDPOINT_DENIED');
    await expect(policy.assert('http://provider.example/token')).rejects.toThrow('NETWORK_ENDPOINT_INVALID');
  });
  it('pins explicitly trusted workload services to one TLS origin', async () => {
    const policy = NetworkPolicy.service('https://127.0.0.1:8444');
    await expect(policy.assert('https://127.0.0.1:8444/v1/envelopes')).resolves.toBeInstanceOf(URL);
    await expect(policy.assert('https://127.0.0.1:8445/v1/envelopes')).rejects.toThrow('NETWORK_ENDPOINT_DENIED');
    await expect(policy.assert('http://127.0.0.1:8444/v1/envelopes')).rejects.toThrow('NETWORK_ENDPOINT_INVALID');
  });
});
