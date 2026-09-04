import { createFetchChannel } from '@shop/sdk/channel';
import { createFetchOrganization } from '@shop/sdk/organization';
import { createFetchRuntime } from '@shop/sdk/runtime';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/RequestContext';
import { CONTROL_PAGE_LIMIT } from '../model/Control';
import type { ControlPort } from '../public';
import { ControlMapper } from './ControlMapper';

export class ControlGateway implements ControlPort {
  private readonly channel;
  private readonly organization;
  private readonly runtimeOperations;
  private readonly mapper = new ControlMapper();

  constructor(baseUrl: string) {
    this.channel = createFetchChannel(baseUrl);
    this.organization = createFetchOrganization(baseUrl);
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
    const value = await this.runtimeOperations.healthDependency({}, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.runtime(value);
  }
}

function pageQuery(cursor?: string) {
  return { limit: CONTROL_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) };
}
