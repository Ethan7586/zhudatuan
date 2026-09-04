import { spawn } from 'node:child_process';
import { Client } from 'pg';
import { localSeedEnvironment } from '@shop/config/server';
import { localSecret } from '@shop/localinfra';
import { KmsClient } from '../../../../01_core_hexin/services/commerce/src/foundation/infrastructure/KmsClient';
import { copyLatestLocalRegistrationOtp, LOCAL_REGISTRATION_OTP_COPIED } from './LocalRegistrationOtp';

async function main(): Promise<void> {
  const environment = localSeedEnvironment();
  await copyLatestLocalRegistrationOtp(
    {
      appEnv: process.env.APP_ENV,
      mobile: process.env.LOCAL_OTP_MOBILE,
      platform: process.platform,
      secretStoreEndpoint: environment.secretStoreEndpoint,
      secretStoreBearerToken: environment.secretStoreBearerToken,
      kmsEndpoint: environment.kmsEndpoint,
      kmsBearerToken: environment.kmsBearerToken,
      adminDatabaseConnectionRef: environment.adminDatabaseConnectionRef,
      identityKeyRef: environment.identityKeyRef,
    },
    {
      readSecret: localSecret,
      openDatabase: async connectionString => {
        const client = new Client({ connectionString });
        await client.connect();
        return client;
      },
      decrypt: (endpoint, keyRef, ciphertext, context) => new KmsClient(endpoint, environment.kmsBearerToken).decrypt(keyRef, ciphertext, context),
      copy: copyToMacClipboard,
    }
  );
  process.stdout.write(LOCAL_REGISTRATION_OTP_COPIED);
}

function copyToMacClipboard(value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/pbcopy', [], { shell: false, stdio: ['pipe', 'ignore', 'ignore'] });
    child.once('error', () => reject(new Error('LOCAL_OTP_CLIPBOARD_UNAVAILABLE')));
    child.once('exit', code => (code === 0 ? resolve() : reject(new Error('LOCAL_OTP_CLIPBOARD_FAILED'))));
    child.stdin.end(value);
  });
}

main().catch(() => {
  process.stderr.write('LOCAL_REGISTRATION_OTP_COPY_FAILED\n');
  process.exitCode = 1;
});
