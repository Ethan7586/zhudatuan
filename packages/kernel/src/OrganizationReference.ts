const ORGANIZATION_REFERENCE = /^[a-z][a-z0-9:.-]{2,127}$/;
const UUID_REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isOrganizationReference(value: string): boolean {
  return ORGANIZATION_REFERENCE.test(value) && !UUID_REFERENCE.test(value);
}
