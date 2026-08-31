export function boundedIdentifiers(values: readonly string[], maximum: number, code: string): readonly string[] {
  const selected = [...new Set(values)];
  if (selected.length > maximum || selected.some((value) => !/^[^\s,]{1,256}$/.test(value))) throw new Error(code);
  return Object.freeze(selected);
}
