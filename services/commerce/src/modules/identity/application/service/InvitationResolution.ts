import type { CipherEnvelope } from '../../../../pipeline/KmsPort';
import type { Invitation } from '../../domain/model/Invitation';
import type { AuthTransaction } from '../../domain/model/AuthTransaction';
import type { RegistrationPolicyRecord } from '../port/RegistrationPolicyRepository';
import type { SignedReturnTarget } from '../port/ReturnTargetPort';

export interface LoadedInvitationResolution {
  readonly invitation: Invitation;
  readonly target: 'console' | 'storefront' | 'miniapp' | 'store' | 'supplier';
  readonly principal: string | null;
  readonly mobileCiphertext: string | null;
  readonly organizationName: string;
  readonly policy: RegistrationPolicyRecord | null;
}

interface PreparedInvitationProof {
  readonly challenge: string;
  readonly code: string;
  readonly codeEnvelope: CipherEnvelope;
  readonly destinationEnvelope: CipherEnvelope;
}

export interface PreparedInvitationResolution {
  readonly loaded: LoadedInvitationResolution;
  readonly token: string;
  readonly claim: string;
  readonly browser: Buffer;
  readonly device: Buffer;
  readonly destination: SignedReturnTarget;
  readonly authorization: Readonly<{ transaction: AuthTransaction; stateHash: string; nonceHash: string; challenge: string }>;
  readonly proof?: PreparedInvitationProof;
}
