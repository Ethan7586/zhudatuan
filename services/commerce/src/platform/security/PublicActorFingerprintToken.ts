import { token } from '../../composition/Container';
import type { PublicActorFingerprint } from './PublicActorFingerprint';

export const PUBLIC_ACTOR_FINGERPRINT = token<PublicActorFingerprint>('security.publicactorfingerprint');
