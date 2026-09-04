import { describe, expect, it } from 'vitest';
import { jobDefinition, type JobKind } from '../../../foundation/application/JobCatalog';
import { JobRegistry } from '../application/registry/JobRegistry';
import { ProcessorRegistry } from '../application/registry/ProcessorRegistry';

const processorJobs: readonly JobKind[] = Object.freeze([
  'memberimport', 'catalogimport', 'inventoryimport', 'orderimport', 'credentialimport', 'financeimport', 'export', 'voucherexport',
]);

describe('Runtime ProcessorRegistry', () => {
  it('maps every import and export strategy to one registered business processor', () => {
    const jobs = registry(processorJobs);
    const processors = new ProcessorRegistry(jobs);
    expect(processors.imports.all()).toHaveLength(6);
    expect(processors.exports.all()).toHaveLength(5);
    expect(processors.exports.get('voucher', 'credential')?.job).toBe('voucherexport');
  });

  it('fails composition when a declared strategy has no processor', () => {
    const jobs = registry(processorJobs.filter((id) => id !== 'financeimport'));
    expect(() => new ProcessorRegistry(jobs)).toThrow('PROCESSOR_MISSING:finance:statement:financeimport');
  });
});

function registry(ids: readonly JobKind[]): JobRegistry {
  const jobs = new JobRegistry();
  for (const id of ids) {
    const definition = jobDefinition(id);
    jobs.register({ id, job: { id, execute: async () => undefined }, lease: definition.lease, batch: 10,
      concurrency: definition.concurrency, deadline: definition.timeout });
  }
  jobs.freeze();
  return jobs;
}
