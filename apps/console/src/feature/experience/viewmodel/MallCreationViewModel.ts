import { OP_ORGANIZATION_LAYERS_READ, OP_ORGANIZATION_MALLS_CREATE, OP_ORGANIZATION_MALLS_READ, OP_ORGANIZATION_MALLS_UPDATE } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { ExperienceDependencies } from '../../../app/Dependencies';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { canUseOperation, requiredAssurance } from '../../../shared/security/OperationAccess';
import { firstInvalidMallContentSection, initialMallDraft, mallCreateDraft, mallOpeningDraft, mallUpdateDraft, selectTheme, validateMallContentSection, validateMallStep, type MallOpeningDraft } from '../model/MallDraft';
import type { ExperienceAction } from '../model/Experience';
import type { MallReceipt, ThemePresetId } from '../model/Mall';

const lastStep = 3;

export function useMallCreationViewModel(context: ConsoleContext, dependencies: ExperienceDependencies, action: ExperienceAction | null, requestStepup: () => void, refresh: () => Promise<unknown>) {
  const mode = action?.kind === 'manage' ? 'update' : 'create';
  const open = action?.kind === 'create' || action?.kind === 'manage';
  const sourceMall = action?.kind === 'manage' ? action.record.mallId : undefined;
  const actionKey = action?.kind === 'manage' ? `update:${sourceMall}` : (action?.kind ?? 'closed');
  const operation = mode === 'create' ? OP_ORGANIZATION_MALLS_CREATE : OP_ORGANIZATION_MALLS_UPDATE;
  const key = `draft:1:${context.scope.id}:${OP_ORGANIZATION_MALLS_CREATE}:new`;
  const store = dependencies.drafts;
  const hydrated = useRef('');
  const [draft, setDraft] = useState(() => store.load(key, initialMallDraft(context)));
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [validationVisible, setValidationVisible] = useState(false);
  const [validationRequest, setValidationRequest] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<MallReceipt>();
  const parents = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_LAYERS_READ, 'mallparents'],
    queryFn: ({ signal }) => dependencies.readMallParents.execute(context, signal),
    enabled: open && canUseOperation(context, OP_ORGANIZATION_LAYERS_READ),
    staleTime: 30_000,
  });
  const mall = useQuery({
    queryKey: ['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ORGANIZATION_MALLS_READ, sourceMall],
    queryFn: ({ signal }) => dependencies.malls.read(context, sourceMall!, signal),
    enabled: mode === 'update' && sourceMall !== undefined && canUseOperation(context, OP_ORGANIZATION_MALLS_READ),
    staleTime: 10_000,
  });

  useEffect(() => {
    hydrated.current = '';
    setStep(0);
    setFurthestStep(0);
    setValidationVisible(false);
    setConfirmed(false);
    setReceipt(undefined);
    setIdentity(dependencies.createIdentity());
    if (action?.kind === 'create') setDraft(store.load(key, initialMallDraft(context)));
  }, [actionKey, action?.kind, context, dependencies, key, store]);
  useEffect(() => {
    const record = mall.data;
    if (mode !== 'update' || !record) return;
    const token = `${record.id}:${record.version}`;
    if (hydrated.current === token) return;
    hydrated.current = token;
    setDraft(mallOpeningDraft(record));
  }, [mall.data, mode]);
  useEffect(() => {
    const first = parents.data?.items.find((parent) => parent.kind === 'enterprise') ?? parents.data?.items[0];
    if (mode !== 'create' || !first || draft.parentId) return;
    setDraft((current) => Object.freeze({ ...current, parentId: first.id, timezone: first.timezone, companyName: current.companyName || first.name }));
  }, [draft.parentId, mode, parents.data?.items]);
  useEffect(() => {
    if (open && mode === 'create' && !receipt) store.save(key, draft);
  }, [draft, key, mode, open, receipt, store]);
  useEffect(() => {
    if (!open || receipt) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, receipt]);

  const parentRequired = mode === 'create';
  const currentValidation = validateMallStep(draft, step, parents.data?.items ?? [], parentRequired);
  const validation = validationVisible ? currentValidation : undefined;
  const mutation = useMutation({
    mutationFn: () =>
      mode === 'create' ? dependencies.createApplication.execute(context, mallCreateDraft(draft, parents.data?.items ?? []), identity) : dependencies.updateMall.execute(context, mall.data!.id, mall.data!.version, mallUpdateDraft(draft), identity),
    onSuccess: async (record) => {
      if (mode === 'create') store.clear(key);
      setReceipt(Object.freeze({ requestId: identity, action: mode === 'create' ? 'created' : 'updated', mall: record, application: mode === 'create' ? 'initializing' : 'ready' }));
      await refresh();
    },
  });
  const change = (patch: Partial<MallOpeningDraft>) => {
    setDraft((current) => Object.freeze({ ...current, ...patch }));
    setConfirmed(false);
    setValidationVisible(false);
    setIdentity(dependencies.createIdentity());
    mutation.reset();
  };
  const next = () => {
    if (currentValidation) {
      setValidationVisible(true);
      setValidationRequest((value) => value + 1);
      return;
    }
    if (step < lastStep) {
      const nextStep = step + 1;
      setStep(nextStep);
      setFurthestStep((current) => Math.max(current, nextStep));
      setValidationVisible(false);
    }
  };
  const submit = () => {
    if (step !== lastStep || !confirmed || mutation.isPending || (mode === 'update' && !mall.data)) return;
    const invalidStep = [0, 1, 2].find((candidate) => validateMallStep(draft, candidate, parents.data?.items ?? [], parentRequired) !== undefined);
    if (invalidStep !== undefined) {
      setStep(invalidStep);
      setValidationVisible(true);
      setValidationRequest((value) => value + 1);
      return;
    }
    if (context.session.assurance.level < requiredAssurance(operation)) {
      requestStepup();
      return;
    }
    mutation.mutate();
  };
  const available = canUseOperation(context, operation) && (mode === 'create' ? canUseOperation(context, OP_ORGANIZATION_LAYERS_READ) : canUseOperation(context, OP_ORGANIZATION_MALLS_READ));
  return Object.freeze({
    mode,
    draft,
    step,
    furthestStep,
    lastStep,
    confirmed,
    receipt,
    validation,
    validationRequest,
    contentValidation: Object.freeze({
      subject: validateMallContentSection(draft, 'subject'),
      channel: validateMallContentSection(draft, 'channel'),
      delivery: validateMallContentSection(draft, 'delivery'),
      first: firstInvalidMallContentSection(draft)?.section,
    }),
    parents: parents.data?.items ?? [],
    parentsPending: parents.isPending,
    parentsError: parents.error ? presentError(parents.error).message : undefined,
    recordPending: mode === 'update' && mall.isPending,
    recordError: mall.error ? presentError(mall.error).message : undefined,
    available,
    assurance: context.session.assurance.level,
    required: requiredAssurance(operation),
    busy: mutation.isPending,
    error: mutation.error ? presentError(mutation.error).message : undefined,
    actions: Object.freeze({
      change,
      theme: (preset: ThemePresetId) => {
        setDraft((current) => selectTheme(current, preset));
        setConfirmed(false);
        setValidationVisible(false);
        setIdentity(dependencies.createIdentity());
        mutation.reset();
      },
      step: (value: number) => {
        if (value < 0 || value > lastStep) return;
        if (value <= furthestStep) {
          setStep(value);
          setValidationVisible(false);
          return;
        }
        if (value === step + 1) next();
      },
      next,
      previous: () => {
        setStep(Math.max(0, step - 1));
        setValidationVisible(false);
      },
      confirmed: setConfirmed,
      submit,
      stepup: requestStepup,
      reset: () => {
        if (mode === 'create') {
          store.clear(key);
          setDraft(initialMallDraft(context));
        } else if (mall.data) setDraft(mallOpeningDraft(mall.data));
        setStep(0);
        setFurthestStep(0);
        setValidationVisible(false);
        setConfirmed(false);
        setReceipt(undefined);
        setIdentity(dependencies.createIdentity());
        mutation.reset();
      },
    }),
  });
}

export type MallCreationViewModel = ReturnType<typeof useMallCreationViewModel>;
