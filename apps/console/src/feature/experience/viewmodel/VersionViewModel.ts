import { presentError, type Receipt } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { createExperienceDocument, experienceContent } from '../model/ExperiencePolicy';
import type { Experience, ExperienceAction } from '../model/Experience';
import { applicationDetailKey } from './ExperienceQueryKey';

export function useVersionViewModel(action: ExperienceAction | null, context: ConsoleContext, dependencies: ExperienceDependencies, requestStepup: () => void, refreshList: () => Promise<unknown>) {
  const record = action?.kind === 'design' ? action.record : undefined;
  const detail = useQuery({ queryKey: applicationDetailKey(context, record?.id ?? 'closed'), queryFn: ({ signal }) => dependencies.readDetail.execute(context, record?.id ?? '', signal), enabled: record !== undefined, staleTime: 30_000 });
  const current = experienceContent(detail.data, record);
  const [title, setTitle] = useState(current.title);
  const [announcement, setAnnouncement] = useState(current.announcement);
  const [proof, setProof] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<Receipt>();
  const actionId = record?.id ?? 'closed';
  useEffect(() => {
    const content = experienceContent(detail.data, record);
    setTitle(content.title); setAnnouncement(content.announcement); setProof(''); setConfirmed(false); setIdentity(dependencies.createIdentity()); setReceipt(undefined);
  }, [actionId, detail.data?.head?.id, dependencies, record]);
  const mutation = useMutation({
    mutationFn: async (input: Readonly<{ record: Experience; title: string; announcement: string; proof: string; identity: string }>) => {
      const saved = await dependencies.save.execute(context, { application: input.record.id, configuration: createExperienceDocument(input.record.id, input.title, input.announcement), reason: '控制台商城装修发布' }, input.identity);
      const validation = await dependencies.validate.execute(context, saved.id, input.identity);
      if (validation.validation_state !== 'valid') throw new Error('EXPERIENCE_PUBLICATION_INVALID');
      const publication = await dependencies.publish.execute(context, saved.id, input.record.version, input.proof, input.identity);
      const latest = await dependencies.readDetail.execute(context, input.record.id);
      return { publication, latest };
    },
    onSuccess: async ({ publication }, input) => {
      setReceipt(Object.freeze({ requestId: input.identity, reference: publication.id, occurredAt: publication.effective_at, message: '装修版本已校验并发布，商城入口已按服务端最新有效版本重读。' }));
      await refreshList();
    },
  });
  const restore = useMutation({
    mutationFn: async (input: Readonly<{ record: Experience; source: string; proof: string; identity: string }>) => {
      const restored = await dependencies.restore.execute(context, input.source, input.proof, input.identity);
      const validation = await dependencies.validate.execute(context, restored.id, input.identity);
      if (validation.validation_state !== 'valid') throw new Error('EXPERIENCE_PUBLICATION_INVALID');
      const publication = await dependencies.publish.execute(context, restored.id, input.record.version, input.proof, input.identity);
      await dependencies.readDetail.execute(context, input.record.id);
      return publication;
    },
    onSuccess: async (publication, input) => { setReceipt(Object.freeze({ requestId: input.identity, reference: publication.id, occurredAt: publication.effective_at, message: '历史装修版本已恢复、重新发布并完成权威重读。' })); await refreshList(); },
  });
  const validation = useMemo(() => validate(record, title, announcement, proof, confirmed), [announcement, confirmed, proof, record, title]);
  const reset = (setter: (value: string) => void) => (value: string) => { setter(value); setConfirmed(false); setIdentity(dependencies.createIdentity()); setReceipt(undefined); };
  const ensureStepup = () => { if (context.session.assurance.level < 3) { requestStepup(); return false; } return true; };
  const submit = () => { if (!record || validation || mutation.isPending || !ensureStepup()) return; mutation.mutate({ record, title, announcement, proof, identity }); };
  const restorePrevious = () => {
    const source = detail.data?.history.find((version) => version.id !== detail.data?.head?.id) ?? detail.data?.history[0];
    if (!record || !source || validation || restore.isPending || !ensureStepup()) return;
    restore.mutate({ record, source: source.id, proof, identity });
  };
  return Object.freeze({ record, detail: detail.data, detailPending: detail.isPending, detailFailed: detail.isError, title, announcement, proof, confirmed, validation, assurance: context.session.assurance.level, busy: mutation.isPending || restore.isPending, error: mutation.error || restore.error ? presentError(mutation.error ?? restore.error).message : undefined, receipt, actions: Object.freeze({ title: reset(setTitle), announcement: reset(setAnnouncement), proof: reset(setProof), confirmed: setConfirmed, submit, restore: restorePrevious, stepup: requestStepup }) });
}

function validate(record: Experience | undefined, title: string, announcement: string, proof: string, confirmed: boolean): string | undefined {
  if (!record) return undefined;
  if (!title.trim() || title.trim().length > 80) return '首页主标题须为 1 至 80 个字符。';
  if (!announcement.trim() || announcement.trim().length > 240) return '公告文案须为 1 至 240 个字符。';
  if (!confirmed) return '请先核对预览、发布范围和当前线上影响。';
  if (!/^[A-Za-z0-9_-]{43,4096}$/.test(proof)) return '请输入 Step-up 后签发的一次性复核凭证。';
  return undefined;
}

export type VersionViewModel = ReturnType<typeof useVersionViewModel>;
