import type { CommandBus } from '../foundation/application/CommandBus';
import type { QueryBus } from '../foundation/application/QueryBus';
import type { Container } from './Container';
import type { ExtensionRegistry } from './ExtensionRegistry';
import type { JobRegistry } from './JobRegistry';
import type { RouteRegistry } from './RouteRegistry';

export interface ModuleContext {
  readonly workload: 'api' | 'jobs';
  readonly container: Container;
  readonly commands: CommandBus;
  readonly queries: QueryBus;
  readonly routes: RouteRegistry;
  readonly jobs: JobRegistry;
  readonly extensions: ExtensionRegistry;
}

export interface CommerceModule {
  readonly id: string;
  readonly dependencies: readonly string[];
  register(context: ModuleContext): void | Promise<void>;
}

// L-ARCH-WIRING: connect selected modules in dependency order; no business facts live here.
export class ModuleRegistry {
  private readonly modules = new Map<string, CommerceModule>();

  add(module: CommerceModule): void {
    if (this.modules.has(module.id)) throw new Error(`MODULE_DUPLICATE:${module.id}`);
    this.modules.set(module.id, module);
  }

  async load(context: ModuleContext): Promise<void> {
    for (const module of ordered(this.modules)) await module.register(context);
  }

  catalog(): readonly string[] {
    return Object.freeze([...this.modules.keys()].sort());
  }
}

function ordered(modules: ReadonlyMap<string, CommerceModule>): readonly CommerceModule[] {
  const result: CommerceModule[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`MODULE_DEPENDENCY_CYCLE:${id}`);
    const module = modules.get(id);
    if (!module) throw new Error(`MODULE_DEPENDENCY_MISSING:${id}`);
    visiting.add(id);
    for (const dependency of module.dependencies) visit(dependency);
    visiting.delete(id);
    visited.add(id);
    result.push(module);
  };
  for (const id of modules.keys()) visit(id);
  return result;
}
