import { posix } from 'node:path';

export function normalizeRepoPath(value) {
  return posix.normalize(String(value).replaceAll('\\', '/')).replace(/^\.\//, '');
}

export function matchesGlob(value, pattern) {
  const normalized = normalizeRepoPath(value);
  return globRegex(normalizeRepoPath(pattern)).test(normalized);
}

export function matchesAny(value, patterns = []) {
  return patterns.some((pattern) => matchesGlob(value, pattern));
}

const cache = new Map();

function globRegex(pattern) {
  const cached = cache.get(pattern);
  if (cached) return cached;
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      const next = pattern[index + 1];
      if (next === '*') {
        const slash = pattern[index + 2] === '/';
        expression += slash ? '(?:.*/)?' : '.*';
        index += slash ? 2 : 1;
      } else {
        expression += '[^/]*';
      }
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += /[\\^$+?.()|{}\[\]]/.test(character) ? `\\${character}` : character;
    }
  }
  expression += '$';
  const compiled = new RegExp(expression);
  cache.set(pattern, compiled);
  return compiled;
}
