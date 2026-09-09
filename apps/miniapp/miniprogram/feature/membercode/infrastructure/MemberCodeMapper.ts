import qrcode from 'qrcode-generator';
import { encodeMemberCode } from '@shop/contract/verification';
import type { OperationOutputFor } from '@shop/contract';
import type { MiniappMemberCode } from '../model/MemberCode';

export function mapMemberCode(value: OperationOutputFor<'verification.membercodes.issue'>): MiniappMemberCode {
  const issuedAt = Date.parse(value.issued_at);
  const expiresAt = Date.parse(value.expires_at);
  if (value.state !== 'issued' || !Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt) throw new Error('MINIAPP_MEMBER_CODE_RESPONSE_INVALID');
  const credential = encodeMemberCode({ challenge: value.id, token: value.token });
  const matrix = qrcode(0, 'M');
  matrix.addData(credential, 'Byte');
  matrix.make();
  const matrixSize = matrix.getModuleCount();
  const modules = Array.from({ length: matrixSize * matrixSize }, (_, index) =>
    Object.freeze({ key: String(index), dark: matrix.isDark(Math.floor(index / matrixSize), index % matrixSize) })
  );
  return Object.freeze({ challenge: value.id, version: Number(value.version), issuedAt, expiresAt, matrixSize, modules: Object.freeze(modules) });
}
