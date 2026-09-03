import type { VoucherActionViewModel } from '../viewmodel/VoucherActionViewModel';
import { ApprovalDialog } from './ApprovalDialog';
import { BindingDialog } from './BindingDialog';
import { CardLibraryDialog } from './CardLibraryDialog';
import { IssueDialog } from './IssueDialog';
import { ProgramDialog } from './ProgramDialog';
import { ReserveDialog } from './ReserveDialog';
import { ReversalDialog } from './ReversalDialog';
import { StatusBatchDialog } from './StatusBatchDialog';

export function VoucherDialogs({ model, onClose }: Readonly<{ model: VoucherActionViewModel; onClose: () => void }>) {
  return <><CardLibraryDialog model={model} onClose={onClose} /><ProgramDialog model={model} onClose={onClose} /><ReserveDialog model={model} onClose={onClose} /><ApprovalDialog model={model} onClose={onClose} /><IssueDialog model={model} onClose={onClose} /><StatusBatchDialog model={model} onClose={onClose} /><BindingDialog model={model} onClose={onClose} /><ReversalDialog model={model} onClose={onClose} /></>;
}
