import { localKmsEnvironment } from '@shop/config/server';
import { startLocalHttps, workloadBearerPreflight } from '../../localinfra/src/Http';
import { kmsHandler } from './Handler';
import { LocalKms } from './LocalKms';

const environment = localKmsEnvironment();
const kms = new LocalKms(environment.kmsMasterKey);

await startLocalHttps(
  'localkms',
  environment.kmsPort,
  kmsHandler(kms, environment.kmsBearerToken),
  {
    certificateFile: environment.tlsCertificateFile,
    keyFile: environment.tlsKeyFile,
  },
  9 * 1024 * 1024,
  workloadBearerPreflight(environment.kmsBearerToken),
  environment.bindHost
);
