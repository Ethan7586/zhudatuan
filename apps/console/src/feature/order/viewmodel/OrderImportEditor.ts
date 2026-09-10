import { validateImportFile } from '../../../shared/import/ImportUploadGateway';

export interface OrderImportEditor {
  readonly step: 1 | 2 | 3;
  readonly file: File | null;
  readonly confirmed: boolean;
}

export function importValidation(editor: OrderImportEditor | undefined, assurance: number): string | undefined {
  if (!editor) return undefined;
  if (editor.step === 1) return undefined;
  if (!editor.file) return '请选择 CSV 或 XLSX 文件。';
  const fileError = validateImportFile(editor.file);
  if (fileError) return fileError;
  if (editor.step === 2) return undefined;
  if (!editor.confirmed) return '请确认服务端将校验来源证明、映射、金额分解和重复订单。';
  return assurance < 3 ? '提交外部订单前请完成高强度二次验证。' : undefined;
}
