import type { ComponentIssue } from './ComponentTree';

export type PublishDependency = 'catalog' | 'marketing' | 'pool' | 'qualification' | 'pricing' | 'inventory' | 'resources' | 'domain' | 'capabilities' | 'channel';
export const PUBLISH_DEPENDENCIES = Object.freeze(['catalog', 'marketing', 'pool', 'qualification', 'pricing', 'inventory', 'resources', 'domain', 'capabilities', 'channel'] as const);
export interface DependencyVersion {
  readonly ready: boolean;
  readonly version: string;
}
export type DependencyEvidence = Readonly<Record<PublishDependency, DependencyVersion>>;
export interface PublishEvidenceSnapshot {
  readonly dependencies: DependencyEvidence;
  readonly issues: readonly ComponentIssue[];
}

export class PublishEvidence {
  private constructor(
    readonly dependencies: DependencyEvidence,
    readonly issues: readonly ComponentIssue[]
  ) {
    Object.freeze(this);
  }

  static collect(dependencies: DependencyEvidence, issues: readonly ComponentIssue[] = []): PublishEvidence {
    return new PublishEvidence(
      Object.freeze(Object.fromEntries(Object.entries(dependencies).map(([name, dependency]) => [name, Object.freeze({ ready: dependency.ready, version: version(dependency.version) })])) as unknown as DependencyEvidence),
      Object.freeze(issues.map((issue) => Object.freeze({ ...issue })))
    );
  }

  static restore(value: unknown): PublishEvidence {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('EXPERIENCE_EVIDENCE_INVALID');
    const dependencies = Reflect.get(value, 'dependencies');
    const issues = Reflect.get(value, 'issues');
    if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies) || !Array.isArray(issues)) throw new Error('EXPERIENCE_EVIDENCE_INVALID');
    const restored = Object.fromEntries(
      PUBLISH_DEPENDENCIES.map((name) => {
        const dependency = Reflect.get(dependencies, name);
        if (dependency === null || typeof dependency !== 'object' || typeof Reflect.get(dependency, 'ready') !== 'boolean' || typeof Reflect.get(dependency, 'version') !== 'string') throw new Error('EXPERIENCE_EVIDENCE_INVALID');
        return [name, { ready: Reflect.get(dependency, 'ready') as boolean, version: Reflect.get(dependency, 'version') as string }];
      })
    ) as DependencyEvidence;
    const restoredIssues = issues.map((issue) => {
      if (issue === null || typeof issue !== 'object' || typeof Reflect.get(issue, 'code') !== 'string' || typeof Reflect.get(issue, 'path') !== 'string' || typeof Reflect.get(issue, 'message') !== 'string')
        throw new Error('EXPERIENCE_EVIDENCE_INVALID');
      return { code: Reflect.get(issue, 'code') as string, path: Reflect.get(issue, 'path') as string, message: Reflect.get(issue, 'message') as string };
    });
    return PublishEvidence.collect(restored, restoredIssues);
  }

  snapshot(): PublishEvidenceSnapshot {
    return Object.freeze({ dependencies: this.dependencies, issues: this.issues });
  }
}

function version(value: string): string {
  if (!value || value.length > 4000) throw new Error('EXPERIENCE_EVIDENCE_VERSION_INVALID');
  return value;
}
