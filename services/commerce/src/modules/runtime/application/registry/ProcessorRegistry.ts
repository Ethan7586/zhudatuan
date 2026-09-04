import type { JobRegistry } from './JobRegistry';
import { ExportRegistry } from './ExportRegistry';
import { ImportRegistry } from './ImportRegistry';

export class ProcessorRegistry {
  readonly imports = new ImportRegistry();
  readonly exports = new ExportRegistry();

  constructor(jobs: JobRegistry) {
    const registered = new Set(jobs.all().map(({ id }) => id));
    for (const descriptor of [...this.imports.all(), ...this.exports.all()]) {
      if (!registered.has(descriptor.job)) throw new Error(`PROCESSOR_MISSING:${descriptor.owner}:${descriptor.kind}:${descriptor.job}`);
      const job = jobs.get(descriptor.job);
      if (job?.owner !== descriptor.owner) throw new Error(`PROCESSOR_OWNER_MISMATCH:${descriptor.owner}:${descriptor.kind}:${descriptor.job}`);
    }
    Object.freeze(this);
  }
}
