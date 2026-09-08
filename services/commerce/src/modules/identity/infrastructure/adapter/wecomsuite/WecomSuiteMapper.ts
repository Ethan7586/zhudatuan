import { DomainError } from '../../../../../platform/error/DomainError';
export class WecomSuiteMapper {
  identity(body: Readonly<Record<string, unknown>>): Readonly<{ tenant: string; subject: string }> {
    if (body.errcode !== 0) throw new DomainError(body.errcode === 40014 || body.errcode === 42001 ? 'IDENTITY_PROVIDER_UNAVAILABLE' : 'FEDERATION_CALLBACK_REJECTED');
    const corp = body.auth_corp_info;
    const user = body.user_info;
    if (corp === null || typeof corp !== 'object' || user === null || typeof user !== 'object') invalid();
    const tenant = (corp as Record<string, unknown>).corpid;
    const subject = (user as Record<string, unknown>).userid;
    if (typeof tenant !== 'string' || !tenant || typeof subject !== 'string' || !subject) invalid();
    return Object.freeze({ tenant, subject });
  }
}
function invalid(): never {
  throw new DomainError('FEDERATION_CALLBACK_REJECTED');
}
