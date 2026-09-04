import type { Receipt } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Experience, ExperienceDetail, ExperienceVersion, ValidationIssue } from '../model/Experience';

interface ReleaseOptions {
  readonly context: ConsoleContext;
  readonly dependencies: ExperienceDependencies;
  readonly refresh: () => Promise<unknown>;
  readonly latest: (detail: ExperienceDetail) => void;
  readonly restored: (version: ExperienceVersion) => void;
  readonly issues: (issues: readonly ValidationIssue[]) => void;
}

export function useDesignerRelease(options: ReleaseOptions) {
  const { context, dependencies } = options;
  const [receipt, setReceipt] = useState<Receipt>();
  const publication = useMutation({
    mutationFn: async (input: Readonly<{ record: Experience; version: ExperienceVersion; identity: string }>) => {
      const current = await dependencies.readDetail.execute(context, input.record.id);
      if (current.head?.id !== input.version.id) throw new Error('VERSION_CONFLICT');
      const published = await dependencies.publish.execute(context, input.version.id, current.version, input.identity);
      return { published, latest: await dependencies.readDetail.execute(context, input.record.id) };
    },
    onSuccess: async ({ published, latest }, input) => {
      options.latest(latest);
      setReceipt(Object.freeze({ requestId: input.identity, reference: published.id, occurredAt: published.effective_at, message: '已校验版本发布成功，商城入口已完成权威重读。' }));
      await options.refresh();
    },
  });
  const restoration = useMutation({
    mutationFn: async (input: Readonly<{ record: Experience; source: string; identity: string }>) => {
      const current = await dependencies.readDetail.execute(context, input.record.id);
      const restored = await dependencies.restore.execute(context, input.source, current.version, input.identity);
      const advanced = await dependencies.readDetail.execute(context, input.record.id);
      if (advanced.head?.id !== restored.id) throw new Error('VERSION_CONFLICT');
      const checked = await dependencies.validate.execute(context, restored.id, input.identity);
      options.issues(checked.issues);
      if (checked.validation_state !== 'valid') throw new Error(checked.issues[0]?.message ?? 'EXPERIENCE_PUBLICATION_INVALID');
      const published = await dependencies.publish.execute(context, restored.id, advanced.version, input.identity);
      return { restored, published, latest: await dependencies.readDetail.execute(context, input.record.id) };
    },
    onSuccess: async ({ restored, published, latest }, input) => {
      options.latest(latest);
      options.restored(restored);
      setReceipt(Object.freeze({ requestId: input.identity, reference: restored.id, occurredAt: published.effective_at, message: '历史版本已恢复为新版本并重新发布，原历史记录保持不变。' }));
      await options.refresh();
    },
  });
  return Object.freeze({ publication, restoration, receipt, clearReceipt: () => setReceipt(undefined) });
}
