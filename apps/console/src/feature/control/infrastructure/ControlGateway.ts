import { createFetchCapability } from '@shop/sdk/capability';
import { createFetchChannel } from '@shop/sdk/channel';
import { createFetchExtension } from '@shop/sdk/extension';
import { createFetchObservability } from '@shop/sdk/observability';
import { createFetchOrganization } from '@shop/sdk/organization';
import { createFetchRisk } from '@shop/sdk/risk';
import { createFetchRuntime } from '@shop/sdk/runtime';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/RequestContext';
import { CONTROL_PAGE_LIMIT } from '../model/Control';
import type { ControlPort } from '../public';
import { ControlMapper } from './ControlMapper';

export class ControlGateway implements ControlPort {
  private readonly channel;
  private readonly capability;
  private readonly extension;
  private readonly observability;
  private readonly organization;
  private readonly risk;
  private readonly runtimeOperations;
  private readonly mapper = new ControlMapper();

  constructor(baseUrl: string) {
    this.channel = createFetchChannel(baseUrl);
    this.capability = createFetchCapability(baseUrl);
    this.extension = createFetchExtension(baseUrl);
    this.observability = createFetchObservability(baseUrl);
    this.organization = createFetchOrganization(baseUrl);
    this.risk = createFetchRisk(baseUrl);
    this.runtimeOperations = createFetchRuntime(baseUrl);
  }

  async platform(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.organization.layersRead({ query: pageQuery(cursor) }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.platform(value);
  }

  async distribution(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.channel.distributorsRead({ query: pageQuery(cursor) }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.distribution(value);
  }

  async runtime(context: ConsoleContext, signal?: AbortSignal) {
    const request = consoleRequest(context.scope, signal, context.session.accessVersion);
    const [runtime, capabilities, extensions, risk, observability, serviceLevels] = await Promise.all([
      this.runtimeOperations.healthDependency({}, request),
      readAll((cursor) => this.capability.assignmentsRead({ query: pageQuery(cursor, 100) }, request)),
      readAll((cursor) => this.extension.installationsRead({ query: pageQuery(cursor, 100) }, request)),
      readAll((cursor) => this.risk.centerRead({ query: pageQuery(cursor, 100) }, request)),
      this.observability.healthoverviewRead({}, request),
      this.observability.sloRead({}, request),
    ]);
    return Object.freeze({
      runtime: this.mapper.runtime(runtime),
      capabilities: this.mapper.capabilities(capabilities),
      extensions: this.mapper.extensions(extensions),
      risk: this.mapper.risk(risk),
      observability: this.mapper.observability(observability),
      serviceLevels: this.mapper.serviceLevels(serviceLevels),
    });
  }
}

function pageQuery(cursor?: string, limit = CONTROL_PAGE_LIMIT) {
  return { limit, ...(cursor === undefined ? {} : { cursor }) };
}

async function readAll<T>(read: (cursor?: string) => Promise<Readonly<{ items: readonly T[]; count: number; nextCursor?: string | undefined }>>) {
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await read(cursor);
    if (page.count !== page.items.length) throw new Error('CONTROL_SOURCE_PAGE_COUNT_MISMATCH');
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor !== undefined && cursors.has(cursor)) throw new Error('CONTROL_SOURCE_CURSOR_CYCLE');
    if (cursor !== undefined) cursors.add(cursor);
    if (cursors.size > 100) throw new Error('CONTROL_SOURCE_PAGE_LIMIT_EXCEEDED');
  } while (cursor !== undefined);
  return Object.freeze({ items: Object.freeze(items), count: items.length });
}
