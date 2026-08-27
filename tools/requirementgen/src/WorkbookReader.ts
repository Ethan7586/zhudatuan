export function sharedStrings(source: string): readonly string[] {
  return [...source.matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((match) => [...match[1]!.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]!)).join('').trim());
}

export function worksheet(source: string, strings: readonly string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of source.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = match[1]!;
    const reference = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
    if (!reference) continue;
    const type = /\bt="([^"]+)"/.exec(attributes)?.[1];
    const body = match[2] ?? '';
    const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1]
      ?? [...body.matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)].map((text) => text[1]!).join('');
    result.set(reference, type === 's' ? (raw === '' ? '' : strings[Number(raw)] ?? '') : decodeXml(raw).trim());
  }
  return result;
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code))).replace(/&amp;/g, '&');
}
