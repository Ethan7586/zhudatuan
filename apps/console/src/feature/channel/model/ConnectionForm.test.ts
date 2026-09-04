import { PROVIDER_UI_CATALOGS } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { buildConnectionDraft, initialConnectionValues, validateConnectionDraft } from './ConnectionForm';

describe('Extension manifest connection forms', () => {
  it('builds every MVP provider form from its generated configuration schema without provider branches', () => {
    expect(PROVIDER_UI_CATALOGS).toHaveLength(11);
    for (const provider of PROVIDER_UI_CATALOGS) {
      const values = Object.fromEntries(provider.form.fields.map((field) => [field.key, example(field.kind, field.operation)]));
      const draft = buildConnectionDraft(provider, Object.freeze(values));
      expect(provider.form.schema).toBe(`provider.${provider.id}.v1`);
      expect(draft.healthOperation).toBe(provider.form.healthOperation);
      expect(validateConnectionDraft(provider, draft, false)).toBeUndefined();
      if (provider.transport === 'local') expect(provider.form.fields.map(({ kind }) => kind).filter((kind) => kind !== 'text')).toEqual([]);
      else expect(Object.keys(draft.endpoints)).toEqual(provider.form.fields.flatMap((field) => field.operation ? [field.operation] : []));
    }
  });

  it('keeps the manifest health operation immutable and validates safe URLs, paths and secret references', () => {
    const provider = PROVIDER_UI_CATALOGS.find(({ id }) => id === 'jdproduct')!;
    const values: Record<string, string> = { ...initialConnectionValues(provider), region: 'cn', baseUrl: 'https://provider.example', secretRef: 'secret/channel/jd' };
    for (const field of provider.form.fields) if (field.operation) values[field.key] = `/${field.operation.replaceAll('.', '/')}`;
    const valid = buildConnectionDraft(provider, Object.freeze(values));
    expect(validateConnectionDraft(provider, valid, false)).toBeUndefined();
    expect(validateConnectionDraft(provider, { ...valid, baseUrl: 'http://unsafe.example' }, false)).toContain('HTTPS');
    expect(validateConnectionDraft(provider, { ...valid, endpoints: { ...valid.endpoints, health: '//unsafe.example' } }, false)).toContain('相对路径');
    expect(validateConnectionDraft(provider, { ...valid, secretRef: '' }, true)).toBeUndefined();
  });
});

function example(kind: string, operation?: string): string {
  if (kind === 'url') return 'https://provider.example';
  if (kind === 'secretref') return 'secret/channel/credential';
  if (kind === 'endpoint') return `/${operation?.replaceAll('.', '/')}`;
  return 'cn';
}
