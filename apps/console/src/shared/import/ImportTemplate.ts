export function downloadImportTemplate(kind: string, columns: readonly string[]): void {
  const blob = new Blob([`\uFEFF${columns.join(',')}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${kind}-import-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
