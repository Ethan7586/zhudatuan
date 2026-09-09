export function productAttributes(current: Readonly<Record<string, unknown>>, submitted: Readonly<Record<string, unknown>> | null, coverObject: string | null | undefined): Readonly<Record<string, unknown>> {
  const patch = submitted === null ? {} : { ...submitted };
  delete patch.coverObject;
  const merged: Record<string, unknown> = { ...current, ...patch };
  if (coverObject === null) {
    delete merged.coverObject;
    delete merged.coverUrl;
  } else if (coverObject !== undefined) {
    merged.coverObject = coverObject;
    delete merged.coverUrl;
  }
  return Object.freeze(merged);
}
