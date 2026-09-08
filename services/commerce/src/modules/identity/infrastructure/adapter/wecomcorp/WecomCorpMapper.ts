import { DomainError } from '../../../../../platform/error/DomainError';
export class WecomCorpMapper {
  value(body: Readonly<Record<string, unknown>>): Readonly<{ tenant: string; subject: string }> {
    const code = typeof body.errcode === 'number' ? body.errcode : -1;
    if (code === 40014 || code === 42001) throw new DomainError('IDENTITY_PROVIDER_UNAVAILABLE');
    if (code !== 0) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
    if (typeof body.UserId !== 'string' || !body.UserId || body.UserId.length > 256 || typeof body.CorpId !== 'string' || !body.CorpId || body.CorpId.length > 128) throw new DomainError('FEDERATION_CALLBACK_REJECTED');
    return Object.freeze({ tenant: body.CorpId, subject: body.UserId });
  }
}
