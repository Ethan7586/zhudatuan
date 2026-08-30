const MOBILE = /^\+?[1-9][0-9]{7,14}$/;
const CHINA_NATIONAL = /^1[3-9][0-9]{9}$/;
const CHINA_COUNTRY = /^86(1[3-9][0-9]{9})$/;

export function canonicalMobile(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  if (!MOBILE.test(compact)) throw new Error('MOBILE_INVALID');
  if (CHINA_NATIONAL.test(compact)) return `+86${compact}`;
  const withoutPlus = compact.startsWith('+') ? compact.slice(1) : compact;
  const china = CHINA_COUNTRY.exec(withoutPlus);
  if (china) return `+86${china[1]}`;
  const canonical = compact.startsWith('+') ? compact : `+${compact}`;
  if (!MOBILE.test(canonical)) throw new Error('MOBILE_INVALID');
  return canonical;
}
