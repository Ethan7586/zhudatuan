import type { AuthReturnTargets } from '@shop/config/server';
import { token } from '../../../../composition/Container';

export const RETURN_TARGETS = token<AuthReturnTargets>('identity.returntargets');
