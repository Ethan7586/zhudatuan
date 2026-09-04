import { createFetchApproval, type ApprovalOperations } from '@shop/sdk/approval';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { ApprovalCommand, ApprovalTemplateDraft } from '../model/Approval';
import type { ApprovalPort, ApprovalReadRequest } from '../public';
import { ApprovalMapper } from './ApprovalMapper';

export class ApprovalGateway implements ApprovalPort {
  private readonly operations: ApprovalOperations;
  private readonly mapper = new ApprovalMapper();

  constructor(baseUrl: string) {
    this.operations = createFetchApproval(baseUrl);
  }

  async read(context: ConsoleContext, request: ApprovalReadRequest, signal?: AbortSignal) {
    const requestContext = consoleRequest(context.scope, signal, context.session.accessVersion);
    if (request.kind === 'template') {
      return this.mapper.template(await this.operations.templatesGet({ path: { templateid: request.templateId } }, requestContext));
    }
    const query = { limit: 50, ...(request.cursor === undefined ? {} : { cursor: request.cursor }), ...(request.state === undefined ? {} : { state: request.state }), ...(request.subjectKind === undefined ? {} : { subjectKind: request.subjectKind }) };
    return request.kind === 'tasks'
      ? this.mapper.tasks(await this.operations.tasksList({ query }, requestContext))
      : this.mapper.templates(await this.operations.templatesList({ query }, requestContext));
  }

  async readInstance(context: ConsoleContext, instanceId: string, signal?: AbortSignal) {
    const value = await this.operations.instancesGet({ path: { instanceid: instanceId } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.instance(value);
  }

  async execute(context: ConsoleContext, command: ApprovalCommand, identity: string, signal?: AbortSignal) {
    const request = (expectedVersion?: number) =>
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        idempotencyKey: identity,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      });
    if (command.kind === 'create') {
      return this.mapper.templateReceipt(await this.operations.templatesCreate({ body: templateBody(command.draft) }, request()));
    }
    if (command.kind === 'revise') {
      const value = await this.operations.templatesRevise(
        { path: { templateid: command.template.id }, body: { ...templateBody(command.draft), expectedVersion: command.template.version } },
        request(command.template.version)
      );
      return this.mapper.templateReceipt(value);
    }
    if (command.kind === 'enable' || command.kind === 'disable') {
      const input = { path: { templateid: command.template.id }, body: { expectedVersion: command.template.version, reason: command.reason.trim() } };
      const value = command.kind === 'enable' ? await this.operations.templatesEnable(input, request(command.template.version)) : await this.operations.templatesDisable(input, request(command.template.version));
      return this.mapper.templateReceipt(value);
    }
    const input = { path: { taskid: command.task.id }, body: { expectedVersion: command.task.version, reason: command.reason.trim() } };
    const value = command.kind === 'approve' ? await this.operations.tasksApprove(input, request(command.task.version)) : await this.operations.tasksReject(input, request(command.task.version));
    return this.mapper.taskReceipt(value);
  }
}

function templateBody(draft: ApprovalTemplateDraft) {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    subjectKind: draft.subjectKind,
    steps: draft.steps.map((step, index) => ({
      sequence: index + 1,
      name: step.name.trim(),
      approvers: step.approvers.map((approver) => ({ kind: approver.kind, value: approver.value.trim(), minimumApprovals: approver.minimumApprovals })),
      dueHours: step.dueHours,
    })),
    escalations: draft.escalations.map((escalation) => ({ afterHours: escalation.afterHours, action: escalation.action, ...(escalation.target?.trim() ? { target: escalation.target.trim() } : {}) })),
  };
}
