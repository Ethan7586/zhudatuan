import { parseExperience } from '@shop/contract';
import { describe, expect, it } from 'vitest';
import { Application } from './model/Application';
import { ExperienceVersion } from './model/ExperienceVersion';
import { Publication } from './model/Publication';
import { Release } from './model/Release';
import { PublishPolicy } from './policy/PublishPolicy';
import { ComponentTree } from './value/ComponentTree';
import { PublishEvidence, PUBLISH_DEPENDENCIES, type DependencyEvidence } from './value/PublishEvidence';
import { Theme } from './value/Theme';

const now = '2026-09-04T08:00:00.000Z';

describe('Experience domain', () => {
  it.each(['shop', 'market', 'governance'] as const)('accepts the %s preset through the same theme value object', (preset) => {
    expect(Theme.create({ preset, primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null }).snapshot().preset).toBe(preset);
  });

  it('rejects a fourth visual product and unregistered component configuration fields', () => {
    expect(() => Theme.create({ preset: 'festival', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null } as never)).toThrow();
    expect(() => parseExperience(document([{ id: 'hero', component: 'hero', content: { title: '福利首页', script: 'alert(1)' } }]))).toThrow('EXPERIENCE_COMPONENT_CONTENT_INVALID');
  });

  it('returns stable field paths for component, navigation and dependency failures', () => {
    const source = parseExperience(
      document(
        [
          ...Array.from({ length: 5 }, (_, index) => ({ id: `hero:${index}`, component: 'hero', content: { title: `福利首页 ${index}` } })),
          { id: 'hero:0', component: 'hero', content: { title: '重复组件' }, action: { type: 'link', target: 'https://unsafe.example' } },
        ],
        'missing'
      )
    );
    const tree = ComponentTree.create(source);
    expect(tree.issues()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'BLOCK_ID_DUPLICATE', path: 'pages.0.blocks.5.id' }),
        expect.objectContaining({ code: 'COMPONENT_LIMIT_EXCEEDED', path: 'pages.0.blocks' }),
        expect.objectContaining({ code: 'NAVIGATION_PAGE_MISSING', path: 'navigation.0.page' }),
      ])
    );
    const issues = new PublishPolicy().evaluate(source, PublishEvidence.collect(dependencies({ pricing: false })));
    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PRICING_DEPENDENCY_INVALID', path: 'dependencies.pricing' }), expect.objectContaining({ code: 'ACTION_TARGET_INVALID', path: 'pages.0.blocks.5.action.target' })])
    );
  });

  it('isolates drafts, freezes only a fully evidenced version and never mutates its snapshot', () => {
    const source = ExperienceVersion.create({ id: 'version:one', application: 'application:one', sequence: 1, document: parseExperience(document([])), reason: '保存装修草稿', source: null, actor: 'actor:one', createdAt: now });
    expect(source.snapshot()).toMatchObject({ validation: 'pending', evidence: null, frozenAt: null });
    const validated = source.validate(PublishEvidence.collect(dependencies()));
    const frozen = validated.freeze('2026-09-04T08:01:00.000Z');
    expect(frozen.snapshot()).toMatchObject({ validation: 'valid', frozenAt: '2026-09-04T08:01:00.000Z' });
    expect(frozen.validate(PublishEvidence.collect(dependencies({ inventory: false })))).toBe(frozen);
    expect(source.snapshot()).toMatchObject({ validation: 'pending', frozenAt: null });
  });

  it('creates restoration heads with optimistic application versions and rejects stale writers', () => {
    const application = Application.create({ id: 'application:one', mall: 'mall:one', code: 'MALL_ONE', publicSlug: 'mall-one', name: '一号福利商城', primary: true, head: 'version:one', createdAt: now, updatedAt: now });
    const advanced = application.advance('version:restored', 1, '2026-09-04T08:02:00.000Z');
    expect(advanced.snapshot()).toMatchObject({ head: 'version:restored', version: 2 });
    expect(() => application.advance('version:other', 2, now)).toThrow();
    expect(application.snapshot()).toMatchObject({ head: 'version:one', version: 1 });
  });

  it('keeps release and publication transitions one-way while allowing a failed release retry', () => {
    const release = Release.schedule({ id: 'release:one', application: 'application:one', version: 'version:one', pool: 'pool:one', effectiveAt: now, actor: 'actor:one' });
    const failed = release.fail('OBJECT_STORE_UNAVAILABLE', '2026-09-04T08:01:00.000Z');
    expect(failed.activate().snapshot()).toMatchObject({ state: 'active', failedAt: null, failureCode: null });
    const retired = release.activate().retire('2026-09-04T08:02:00.000Z');
    expect(() => retired.activate()).toThrow();
    expect(() => release.activate().fail('OBJECT_STORE_UNAVAILABLE', now)).toThrow();
    const publication = Publication.stage({
      id: 'publication:one',
      release: 'release:one',
      application: 'application:one',
      version: 'version:one',
      contentHash: 'a'.repeat(64),
      objectKey: 'experience/one.json',
      objectRef: 'object:one',
      objectHash: 'a'.repeat(64),
      objectSize: 42,
      stagedAt: now,
    });
    expect(publication.fail('OBJECT_STORE_UNAVAILABLE').activate(now).snapshot().state).toBe('active');
    expect(() => publication.activate(now).retire().activate(now)).toThrow();
  });
});

function document(blocks: readonly unknown[], page = 'home') {
  return {
    version: 2,
    application: 'application:one',
    theme: { preset: 'shop', primaryColor: '#1F5EFF', accentColor: '#19A974', logoObjectRef: null, faviconObjectRef: null },
    navigation: [{ id: 'navigation:home', label: '首页', page }],
    assets: [],
    pages: [{ id: 'home', path: 'home', blocks }],
  };
}

function dependencies(overrides: Partial<Record<(typeof PUBLISH_DEPENDENCIES)[number], boolean>> = {}): DependencyEvidence {
  return Object.fromEntries(PUBLISH_DEPENDENCIES.map((name) => [name, Object.freeze({ ready: overrides[name] ?? true, version: `${name}:1` })])) as DependencyEvidence;
}
