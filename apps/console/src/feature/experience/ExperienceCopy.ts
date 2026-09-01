import type { Experience } from './ExperienceSchema';

const NAME_LIMIT = 120;
const CODE_LIMIT = 32;
const SLUG_LIMIT = 48;

export type ExperienceCopyIdentity = Readonly<{ name: string; code: string; slug: string }>;

export function experienceCopyIdentity(source: Pick<Experience, 'name' | 'code' | 'public_slug'>, nonce = Date.now()): ExperienceCopyIdentity {
  const token = Math.abs(nonce).toString(36).slice(-8);
  const nameSuffix = ` 副本 ${token}`;
  const codeSuffix = `_COPY_${token.toUpperCase()}`;
  const slugSuffix = `-copy-${token.toLowerCase()}`;
  return Object.freeze({
    name: `${source.name.slice(0, NAME_LIMIT - nameSuffix.length)}${nameSuffix}`,
    code: `${source.code.slice(0, CODE_LIMIT - codeSuffix.length)}${codeSuffix}`,
    slug: `${source.public_slug.slice(0, SLUG_LIMIT - slugSuffix.length)}${slugSuffix}`,
  });
}
