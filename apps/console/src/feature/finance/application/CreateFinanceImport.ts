import { OP_FINANCE_STATEMENTIMPORTS_CREATE, OP_RUNTIME_UPLOADS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import { validateImportFile } from '../../../shared/import/ImportUploadGateway';
import type { FinanceImportDraft } from '../model/FinanceImport';
import type { FinancePort } from '../public';

export class CreateFinanceImport {
  constructor(private readonly port: Pick<FinancePort, 'createImport'>) {}

  execute(context: ConsoleContext, draft: FinanceImportDraft, identity: string, progress?: (processed: number) => void, signal?: AbortSignal) {
    assertOperationAccess(context, OP_RUNTIME_UPLOADS_CREATE);
    assertOperationAccess(context, OP_FINANCE_STATEMENTIMPORTS_CREATE);
    if (!identity || !draft.file || !draft.confirmed || validateImportFile(draft.file)) throw new Error('VALIDATION_FAILED');
    if (!draft.provider.trim() || !draft.partnerId.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(draft.periodStart) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.periodEnd)) throw new Error('VALIDATION_FAILED');
    if (![draft.openingMinor, draft.closingMinor].every((value) => /^-?\d+$/.test(value) && Number.isSafeInteger(Number(value)))) throw new Error('VALIDATION_FAILED');
    return this.port.createImport(context, draft, identity, progress, signal);
  }
}
