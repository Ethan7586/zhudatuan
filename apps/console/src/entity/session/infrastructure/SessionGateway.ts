import { createFetchIdentitySessionDelete, createFetchIdentitySessionRead, createFetchIdentityStepupComplete, createFetchIdentityStepupDisable, createFetchIdentityStepupStart } from '@shop/sdk/identity';
import { createFetchMemberProfileRead } from '@shop/sdk/member';
import { createFetchOrganizationLayersRead } from '@shop/sdk/organization';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { SessionPort } from '../public/SessionPort';
import type { SessionCommandContext, StepupAction } from '../model/Stepup';

export class SessionGateway implements SessionPort {
  private readonly sessionRead: ReturnType<typeof createFetchIdentitySessionRead>;
  private readonly sessionDelete: ReturnType<typeof createFetchIdentitySessionDelete>;
  private readonly stepupStart: ReturnType<typeof createFetchIdentityStepupStart>;
  private readonly stepupComplete: ReturnType<typeof createFetchIdentityStepupComplete>;
  private readonly stepupDisable: ReturnType<typeof createFetchIdentityStepupDisable>;
  private readonly profileRead: ReturnType<typeof createFetchMemberProfileRead>;
  private readonly layersRead: ReturnType<typeof createFetchOrganizationLayersRead>;

  public constructor(baseUrl: string) {
    this.sessionRead = createFetchIdentitySessionRead(baseUrl);
    this.sessionDelete = createFetchIdentitySessionDelete(baseUrl);
    this.stepupStart = createFetchIdentityStepupStart(baseUrl);
    this.stepupComplete = createFetchIdentityStepupComplete(baseUrl);
    this.stepupDisable = createFetchIdentityStepupDisable(baseUrl);
    this.profileRead = createFetchMemberProfileRead(baseUrl);
    this.layersRead = createFetchOrganizationLayersRead(baseUrl);
  }

  public read(signal: AbortSignal): Promise<unknown> {
    return this.sessionRead({}, consoleRequest(undefined, signal));
  }

  public profile(accessVersion: number, signal: AbortSignal): Promise<unknown> {
    return this.profileRead({}, consoleRequest(undefined, signal, accessVersion));
  }

  public layers(scope: Parameters<SessionPort['layers']>[0], accessVersion: number, cursor: string | undefined, signal: AbortSignal): Promise<unknown> {
    return this.layersRead({ query: { limit: 200, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(scope, signal, accessVersion));
  }

  public delete(context: SessionCommandContext): Promise<unknown> {
    return this.sessionDelete({ body: {} }, consoleCommand(undefined, commandOptions(context)));
  }

  public disableStepup(context: SessionCommandContext) {
    return this.stepupDisable({ body: {} }, consoleCommand(undefined, commandOptions(context)));
  }

  public startStepup(context: SessionCommandContext, action?: StepupAction) {
    return this.stepupStart(
      {
        body:
          action === undefined
            ? {}
            : {
                action: {
                  operation: action.operation,
                  resource: action.resource,
                  requestHash: action.requestHash,
                  expectedVersion: action.expectedVersion,
                  makerMembership: action.makerMembership,
                },
              },
      },
      consoleCommand(undefined, commandOptions(context))
    );
  }

  public completeStepup(context: SessionCommandContext, challenge: string, code: string) {
    return this.stepupComplete({ body: { challenge, code } }, consoleCommand(undefined, commandOptions(context)));
  }
}

function commandOptions(context: SessionCommandContext) {
  return {
    accessVersion: context.accessVersion,
    idempotencyKey: context.idempotencyKey,
    ...(context.csrf === undefined ? {} : { csrfToken: context.csrf }),
  };
}
