import { JOB_CATALOG, type JobKind } from '../../../../foundation/application/JobCatalog';
import type { Job as JobProcessor } from '../../../../foundation/application/Job';

export interface JobDescriptor {
  readonly owner: string;
  readonly kind: JobKind;
  readonly queue: string;
  readonly title: string;
}

export interface RegisteredJob<T = unknown> {
  readonly id: string;
  readonly job: JobProcessor<T>;
  readonly lease: number;
  readonly batch: number;
  readonly concurrency: number;
  readonly deadline: number;
  readonly resourceLease?: Readonly<{ prefix: string; seconds: number }>;
}

const ownerNames: Readonly<Record<string, string>> = Object.freeze({
  access: '权限治理', audit: '审计归档', benefit: '福利发放', catalog: '商品目录', channel: '渠道同步',
  experience: '页面发布', extension: '扩展服务', finance: '财务处理', fulfillment: '履约处理', identity: '身份服务',
  inventory: '库存处理', marketing: '营销处理', member: '成员导入', notification: '消息投递', order: '订单处理',
  payment: '支付处理', qualification: '资格治理', referral: '推荐结算', reporting: '报表导出', risk: '风险检查',
  runtime: '系统维护', support: '客服处理', voucher: '卡券处理',
});

export class JobRegistry {
  private readonly descriptors = new Map(JOB_CATALOG.map((entry) => [entry.id, Object.freeze({
    owner: entry.owner,
    kind: entry.id,
    queue: entry.queue,
    title: `${ownerNames[entry.owner] ?? '后台'}任务`,
  })] as const));
  private readonly processors = new Map<string, RegisteredJob>();
  private frozen = false;

  register(definition: RegisteredJob): void {
    if (this.frozen) throw new Error('JOB_REGISTRY_FROZEN');
    if (this.processors.has(definition.id)) throw new Error(`JOB_DUPLICATE:${definition.id}`);
    const descriptor = this.get(definition.id);
    if (descriptor === null) throw new Error(`JOB_KIND_UNKNOWN:${definition.id}`);
    if (definition.lease < 5 || definition.batch < 1 || definition.concurrency < 1 || definition.deadline < 100) {
      throw new Error(`JOB_CONFIGURATION_INVALID:${definition.id}`);
    }
    if (definition.resourceLease && (!/^[a-z][a-z0-9]*$/.test(definition.resourceLease.prefix) || definition.resourceLease.seconds < definition.lease || definition.resourceLease.seconds > 900)) {
      throw new Error(`JOB_RESOURCE_LEASE_INVALID:${definition.id}`);
    }
    const resourceLease = definition.resourceLease === undefined ? undefined : Object.freeze({ ...definition.resourceLease });
    this.processors.set(definition.id, Object.freeze({ ...definition, ...(resourceLease === undefined ? {} : { resourceLease }) }));
  }

  freeze(): void {
    this.frozen = true;
  }

  all(): readonly RegisteredJob[] {
    if (!this.frozen) throw new Error('JOB_REGISTRY_NOT_FROZEN');
    return Object.freeze([...this.processors.values()]);
  }

  get(kind: string): JobDescriptor | null {
    return this.descriptors.get(kind as JobKind) ?? null;
  }

  title(owner: string, kind: string): string {
    const descriptor = this.get(kind);
    if (descriptor !== null && descriptor.owner !== owner) throw new Error(`JOB_OWNER_MISMATCH:${kind}:${owner}:${descriptor.owner}`);
    return descriptor?.title ?? `${ownerNames[owner] ?? '后台'}任务`;
  }
}
