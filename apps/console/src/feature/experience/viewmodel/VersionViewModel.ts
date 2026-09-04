import type { ExperienceAction as BlockAction, ExperienceComponentType } from '@shop/contract';
import { presentError } from '@shop/presentation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { addBlock, addPage, changeTheme, moveBlock, patchBlockAction, patchBlockContent, patchPage, patchTheme, removeBlock, removePage } from '../model/EditorDocument';
import type { ExperienceAction, ExperienceBlock, ExperienceDocument, ExperienceVersion, ValidationIssue } from '../model/Experience';
import { createExperienceDocument } from '../model/ExperiencePolicy';
import type { ThemePresetId } from '../model/Mall';
import { useDesignerAutosave } from './DesignerAutosave';
import { useDesignerRelease } from './DesignerRelease';
import { applicationDetailKey } from './ExperienceQueryKey';

type Device = 'desktop' | 'tablet' | 'mobile';
export function useVersionViewModel(action: ExperienceAction | null, context: ConsoleContext, dependencies: ExperienceDependencies, requestStepup: () => void, refreshList: () => Promise<unknown>) {
  const record = action?.kind === 'design' ? action.record : undefined;
  const key = applicationDetailKey(context, record?.id ?? 'closed');
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: key, queryFn: ({ signal }) => dependencies.readDetail.execute(context, record?.id ?? '', signal), enabled: record !== undefined, staleTime: 30_000 });
  const [document, setDocument] = useState<ExperienceDocument>();
  const [validated, setValidated] = useState<string>();
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [preview, setPreview] = useState<ExperienceVersion>();
  const [confirmed, setConfirmed] = useState(false);
  const [page, setPage] = useState(0);
  const [block, setBlock] = useState<number | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [restoreVersion, setRestoreVersion] = useState('');
  const hydrated = useRef('');
  const autosave = useDesignerAutosave({ context, dependencies, record, document, latest: (latest) => queryClient.setQueryData(key, latest) });

  useEffect(() => {
    if (!record) {
      hydrated.current = '';
      return;
    }
    if (!detail.data || hydrated.current === record.id) return;
    const source = detail.data.head?.configuration ?? createExperienceDocument(record.id, record.name, '欢迎进入企业福利商城');
    hydrated.current = record.id;
    setDocument(source);
    autosave.hydrate(detail.data.head ?? undefined, detail.data.version, !detail.data.head, source);
    setValidated(detail.data.head?.validation_state === 'valid' ? detail.data.head.id : undefined);
    setIssues(detail.data.head?.validation_issues ?? []);
    setPreview(undefined);
    setConfirmed(false);
    setPage(0);
    setBlock(null);
    setRestoreVersion('');
  }, [autosave, detail.data, record]);

  const validation = useMutation({
    mutationFn: (input: Readonly<{ version: string; identity: string }>) => dependencies.validate.execute(context, input.version, input.identity),
    onSuccess: (result) => {
      setIssues(result.issues);
      setValidated(result.validation_state === 'valid' ? result.id : undefined);
    },
  });
  const release = useDesignerRelease({
    context,
    dependencies,
    refresh: refreshList,
    issues: setIssues,
    latest: (latest) => {
      autosave.application(latest.version);
      queryClient.setQueryData(key, latest);
      setConfirmed(false);
    },
    restored: (restored) => {
      setDocument(restored.configuration);
      autosave.hydrate(restored, undefined, false);
      setValidated(restored.id);
      setPreview(undefined);
      setRestoreVersion('');
    },
  });

  const edit = (next: ExperienceDocument) => {
    setDocument(next);
    autosave.changed();
    setValidated(undefined);
    setIssues([]);
    setPreview(undefined);
    release.clearReceipt();
    setConfirmed(false);
  };
  const selectedPage = document?.pages[page];
  const selectedBlock = block === null ? undefined : selectedPage?.blocks[block];
  const busy = autosave.pending || validation.isPending || release.publication.isPending || release.restoration.isPending;
  const errorSource = autosave.error ?? validation.error ?? release.publication.error ?? release.restoration.error;
  const ensureStepup = () => context.session.assurance.level >= 3 || (requestStepup(), false);
  const locate = (path: string) => {
    const match = /^pages\.(\d+)(?:\.blocks\.(\d+))?/.exec(path);
    if (!match) return;
    setPage(Number(match[1]));
    setBlock(match[2] === undefined ? null : Number(match[2]));
  };

  return Object.freeze({
    record,
    detail: detail.data,
    detailPending: detail.isPending,
    detailFailed: detail.isError,
    document,
    savedVersion: autosave.savedVersion,
    preview,
    page,
    block,
    device,
    issues,
    conflict: autosave.conflict,
    receipt: release.receipt,
    confirmed,
    restoreVersion,
    lastSavedAt: autosave.lastSavedAt,
    dirty: autosave.dirty,
    saved: autosave.saved,
    validated: validated === autosave.savedVersion?.id,
    saveState: autosave.state,
    assurance: context.session.assurance.level,
    busy,
    locked: busy || autosave.conflict !== undefined,
    publishable: autosave.saved && validated === autosave.savedVersion?.id && issues.length === 0 && confirmed,
    error: errorSource ? presentError(errorSource).message : undefined,
    actions: Object.freeze({
      save: () => {
        autosave.save();
      },
      reloadConflict: () => {
        const conflict = autosave.conflict;
        if (!record || !conflict) return;
        const source = conflict.latest.head?.configuration ?? createExperienceDocument(record.id, record.name, '欢迎进入企业福利商城');
        setDocument(source);
        autosave.hydrate(conflict.latest.head ?? undefined, conflict.latest.version, false, source);
        setValidated(conflict.latest.head?.validation_state === 'valid' ? conflict.latest.head.id : undefined);
        setIssues(conflict.latest.head?.validation_issues ?? []);
        setPage(0);
        setBlock(null);
        setPreview(undefined);
        setConfirmed(false);
      },
      mergeConflict: () => {
        const conflict = autosave.conflict;
        if (!conflict?.plan.safe) return;
        const source = conflict.latest.head?.configuration ?? conflict.plan.merged;
        setDocument(conflict.plan.merged);
        autosave.hydrate(conflict.latest.head ?? undefined, conflict.latest.version, conflict.plan.needsSave, source);
        setValidated(conflict.plan.needsSave ? undefined : conflict.latest.head?.validation_state === 'valid' ? conflict.latest.head.id : undefined);
        setIssues(conflict.plan.needsSave ? [] : (conflict.latest.head?.validation_issues ?? []));
        setPage(0);
        setBlock(null);
        setPreview(undefined);
        setConfirmed(false);
      },
      validate: () => {
        if (autosave.saved && autosave.savedVersion) validation.mutate({ version: autosave.savedVersion.id, identity: dependencies.createIdentity() });
      },
      preview: () => {
        if (autosave.saved && autosave.savedVersion) setPreview(autosave.savedVersion);
      },
      closePreview: () => setPreview(undefined),
      publish: () => {
        if (record && autosave.savedVersion && autosave.saved && validated === autosave.savedVersion.id && confirmed && ensureStepup())
          release.publication.mutate({ record, version: autosave.savedVersion, identity: dependencies.createIdentity() });
      },
      restore: () => {
        if (record && restoreVersion && !autosave.dirty && ensureStepup()) release.restoration.mutate({ record, source: restoreVersion, identity: dependencies.createIdentity() });
      },
      restoreVersion: setRestoreVersion,
      clearReceipt: release.clearReceipt,
      confirmed: setConfirmed,
      stepup: requestStepup,
      device: setDevice,
      locate,
      selectPage: (index: number) => {
        setPage(index);
        setBlock(null);
      },
      selectBlock: setBlock,
      addPage: () => {
        if (!document || !record) return;
        const next = addPage(document, `${record.id}:page:${dependencies.createIdentity()}`);
        edit(next);
        setPage(next.pages.length - 1);
        setBlock(null);
      },
      removePage: () => {
        if (!document) return;
        edit(removePage(document, page));
        setPage(Math.max(0, page - 1));
        setBlock(null);
      },
      pageField: (field: 'label' | 'path', value: string) => document && edit(patchPage(document, page, { [field]: value })),
      theme: (preset: ThemePresetId) => document && edit(changeTheme(document, preset)),
      themeField: (field: 'primaryColor' | 'accentColor', value: string) => document && edit(patchTheme(document, { [field]: value })),
      addBlock: (type: ExperienceComponentType) => {
        if (!document || !record) return;
        const next = addBlock(document, page, type, `${record.id}:block:${dependencies.createIdentity()}`);
        edit(next);
        setBlock((next.pages[page]?.blocks.length ?? 1) - 1);
      },
      removeBlock: (index: number) => {
        if (!document) return;
        edit(removeBlock(document, page, index));
        setBlock(null);
      },
      moveBlock: (index: number, offset: -1 | 1) => {
        if (!document) return;
        edit(moveBlock(document, page, index, offset));
        setBlock(index + offset);
      },
      content: (content: ExperienceBlock['content']) => document && block !== null && selectedBlock && edit(patchBlockContent(document, page, block, content)),
      blockAction: (value: BlockAction | undefined) => document && block !== null && edit(patchBlockAction(document, page, block, value)),
    }),
  });
}

export type VersionViewModel = ReturnType<typeof useVersionViewModel>;
