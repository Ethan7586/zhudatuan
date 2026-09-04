import { hasFailureCode } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { Experience, ExperienceDetail, ExperienceDocument, ExperienceVersion } from '../model/Experience';
import { planVersionMerge, type VersionMergePlan } from '../model/VersionDifference';

interface AutosaveOptions {
  readonly context: ConsoleContext;
  readonly dependencies: ExperienceDependencies;
  readonly record: Experience | undefined;
  readonly document: ExperienceDocument | undefined;
  readonly latest: (detail: ExperienceDetail) => void;
}
interface SaveInput {
  readonly record: Experience;
  readonly document: ExperienceDocument;
  readonly revision: number;
  readonly expectedVersion: number;
  readonly identity: string;
}
export interface DesignerConflict {
  readonly latest: ExperienceDetail;
  readonly plan: VersionMergePlan;
}

export function useDesignerAutosave(options: AutosaveOptions) {
  const { context, dependencies, record, document } = options;
  const [savedVersion, setSavedVersion] = useState<ExperienceVersion>();
  const [revision, setRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [failedRevision, setFailedRevision] = useState<number>();
  const [lastSavedAt, setLastSavedAt] = useState<string>();
  const [conflict, setConflict] = useState<DesignerConflict>();
  const applicationVersion = useRef(0);
  const base = useRef<ExperienceDocument | undefined>(undefined);
  const identity = useRef<Readonly<{ revision: number; value: string }> | undefined>(undefined);
  const mutation = useMutation({
    mutationFn: async (input: SaveInput) => {
      let saved: ExperienceVersion;
      try {
        saved = await dependencies.save.execute(context, { application: input.record.id, configuration: input.document, reason: '装修器自动保存草稿' }, input.expectedVersion, input.identity);
      } catch (cause) {
        if (!hasFailureCode(cause, 'VERSION_CONFLICT')) throw cause;
        return conflictResult(await dependencies.readDetail.execute(context, input.record.id), base.current ?? input.document, input.document, input.revision);
      }
      const latest = await dependencies.readDetail.execute(context, input.record.id);
      if (latest.head?.id !== saved.id) return conflictResult(latest, base.current ?? input.document, input.document, input.revision);
      return { kind: 'saved' as const, saved, latest, revision: input.revision };
    },
    onSuccess: (result) => {
      if (result.kind === 'conflict') {
        setConflict(Object.freeze({ latest: result.latest, plan: result.plan }));
        setFailedRevision(result.revision);
        return;
      }
      const { saved, latest, revision: completed } = result;
      applicationVersion.current = latest.version;
      base.current = saved.configuration;
      options.latest(latest);
      setSavedVersion(saved);
      setSavedRevision(completed);
      setFailedRevision(undefined);
      setConflict(undefined);
      setLastSavedAt(saved.created_at);
    },
    onError: (_error, input) => setFailedRevision(input.revision),
  });
  const mutate = mutation.mutate;
  const pending = mutation.isPending;
  const persist = useCallback(() => {
    if (!record || !document || revision === savedRevision || pending || conflict) return;
    const currentIdentity = identity.current?.revision === revision ? identity.current.value : dependencies.createIdentity();
    identity.current = Object.freeze({ revision, value: currentIdentity });
    mutate({ record, document, revision, expectedVersion: applicationVersion.current, identity: currentIdentity });
  }, [conflict, dependencies, document, mutate, pending, record, revision, savedRevision]);
  useEffect(() => {
    if (!record || !document || conflict || revision === savedRevision || failedRevision === revision || mutation.isPending) return;
    const timer = window.setTimeout(persist, 900);
    return () => window.clearTimeout(timer);
  }, [conflict, document, failedRevision, record, revision, mutation.isPending, persist, savedRevision]);
  const dirty = revision !== savedRevision;
  const saved = Boolean(savedVersion) && !dirty && !mutation.isPending && failedRevision !== revision;
  return Object.freeze({
    savedVersion,
    conflict,
    lastSavedAt,
    dirty,
    saved,
    state: mutation.isPending ? ('saving' as const) : conflict ? ('conflict' as const) : failedRevision === revision ? ('error' as const) : dirty ? ('dirty' as const) : ('saved' as const),
    pending: mutation.isPending,
    error: mutation.error,
    hydrate: (version: ExperienceVersion | undefined, versionNumber: number | undefined, changed: boolean, source?: ExperienceDocument) => {
      if (versionNumber !== undefined) applicationVersion.current = versionNumber;
      base.current = source ?? version?.configuration;
      setSavedVersion(version);
      setRevision(changed ? 1 : 0);
      setSavedRevision(0);
      setFailedRevision(undefined);
      setConflict(undefined);
      setLastSavedAt(version?.created_at);
      mutation.reset();
    },
    changed: () => {
      setRevision((value) => value + 1);
      setFailedRevision(undefined);
      mutation.reset();
    },
    application: (version: number) => {
      applicationVersion.current = version;
    },
    save: () => {
      setFailedRevision(undefined);
      mutation.reset();
      persist();
    },
  });
}

function conflictResult(latest: ExperienceDetail, base: ExperienceDocument, local: ExperienceDocument, revision: number) {
  const current = latest.head?.configuration ?? base;
  return Object.freeze({ kind: 'conflict' as const, latest, plan: planVersionMerge(base, local, current), revision });
}
