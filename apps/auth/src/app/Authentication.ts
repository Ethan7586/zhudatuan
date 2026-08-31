import type { AuthClient } from '../entity/authentication/AuthClient';
import { IdentityClient } from '../shared/api/IdentityClient';

export const authentication: AuthClient = new IdentityClient();
