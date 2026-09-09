import { localSeedEnvironment, LOCAL_SECRET_REFS } from '@shop/config/server';
import { localSecret } from './LocalSecrets';

const environment = localSeedEnvironment();
if (environment.serviceVersion !== 'local') throw new Error('LOCAL_ACCEPTANCE_CREDENTIALS_FORBIDDEN');

const [password, verificationCode] = await Promise.all([localSecret(environment.ethanPasswordRef), localSecret(LOCAL_SECRET_REFS.identityChallengeCode)]);

process.stdout.write('LOCAL_ACCEPTANCE_ACCOUNT ethan\n');
process.stdout.write(`LOCAL_ACCEPTANCE_PASSWORD ${password}\n`);
process.stdout.write(`LOCAL_ACCEPTANCE_VERIFICATION_CODE ${verificationCode}\n`);
