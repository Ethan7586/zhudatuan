import { OP_NOTIFICATION_ANNOUNCEMENTS_MANAGE, OP_NOTIFICATION_ANNOUNCEMENTS_READ, OP_NOTIFICATION_TEMPLATES_MANAGE, OP_NOTIFICATION_TEMPLATES_READ } from '@shop/contract/ids';
import { presentError, queryCondition, safeQueryError } from '@shop/presentation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import type { NotificationDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import { pageCursor } from '../../../../shared/query/QueryState';
import type { NotificationCommand } from '../model/Command';
import type { AnnouncementEditor, NotificationEditor } from '../model/Editor';
import { announcementEditor, templateEditor } from '../model/EditorFactory';
import { emptyAnnouncement, emptyTemplate, notificationCommand, notificationSection, resolveNotification, type NotificationSection } from '../model/NotificationDraft';
import type { Announcement, AnnouncementPage, AnnouncementState } from '../model/Announcement';
import type { NotificationChannel, NotificationPurpose, NotificationTemplate, TemplatePage, TemplateStatus } from '../model/Template';

type Page = TemplatePage | AnnouncementPage;
type Receipt = Readonly<{ kind: 'template' | 'announcement'; id: string; version: number; state: string }>;

export function useNotificationViewModel(context: ConsoleContext, dependencies: NotificationDependencies, requestStepup: () => void) {
  const [search, setSearch] = useSearchParams();
  const section = notificationSection(search.get('kind'));
  const cursor = search.get('cursor') ?? undefined;
  const query = useQuery<Page>({
    queryKey: Object.freeze([
      'console',
      context.scope.kind,
      context.scope.id,
      context.session.accessVersion,
      section === 'announcements' ? OP_NOTIFICATION_ANNOUNCEMENTS_READ : OP_NOTIFICATION_TEMPLATES_READ,
      section,
      cursor ?? null,
      50,
    ] as const),
    queryFn: ({ signal }) => (section === 'announcements' ? dependencies.read.announcements(context, cursor, signal) : dependencies.read.templates(context, section === 'sms' ? 'sms' : undefined, cursor, signal)),
  });
  const [editor, setEditor] = useState<NotificationEditor>();
  const [reviewing, setReviewing] = useState(false);
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [approval, setApproval] = useState<string>();
  const [approvalError, setApprovalError] = useState<string>();
  const [receipt, setReceipt] = useState<Receipt>();
  const refetch = query.refetch;
  const mutation = useMutation({
    mutationFn: async (command: NotificationCommand): Promise<Receipt> => {
      if (command.kind === 'template') {
        const saved = await dependencies.manageTemplate.execute(context, command.change, command.proof, command.identity);
        const read = await refetch();
        if (read.error) throw read.error;
        return { kind: 'template', id: saved.id, version: saved.version, state: saved.status };
      }
      const saved = await dependencies.manageAnnouncement.execute(context, command.change, command.proof, command.identity);
      const read = await refetch();
      if (read.error) throw read.error;
      return { kind: 'announcement', id: saved.id, version: saved.version, state: saved.state };
    },
    onSuccess: (value) => {
      setEditor(undefined);
      setReviewing(false);
      setApproval(undefined);
      setReceipt(value);
    },
  });
  const resolved = useMemo(() => resolveNotification(editor), [editor]);
  const update = useCallback(
    (change: Partial<NotificationEditor>) => {
      if (mutation.isPending) return;
      setEditor((current) => (current === undefined ? current : ({ ...current, ...change, proof: '', confirmed: false } as NotificationEditor)));
      setReviewing(false);
      setApproval(undefined);
      setApprovalError(undefined);
      setIdentity(dependencies.createIdentity());
      mutation.reset();
    },
    [dependencies, mutation]
  );
  const changeSection = useCallback(
    (value: NotificationSection) => {
      if (mutation.isPending) return;
      setEditor(undefined);
      setReviewing(false);
      setApproval(undefined);
      setSearch((current) => {
        const next = new URLSearchParams(current);
        next.set('kind', value);
        next.delete('cursor');
        return next;
      });
    },
    [mutation.isPending, setSearch]
  );
  const openTemplate = useCallback(
    (value?: NotificationTemplate, mode: 'revise' | 'status' = 'status') => {
      setReviewing(false);
      setApproval(undefined);
      setApprovalError(undefined);
      mutation.reset();
      setIdentity(dependencies.createIdentity());
      setEditor(value ? templateEditor(value, mode, mode === 'revise' ? dependencies.createReference('template') : value.id) : emptyTemplate(dependencies.createReference('template'), section === 'sms' ? 'sms' : 'inapp'));
    },
    [dependencies, mutation, section]
  );
  const openAnnouncement = useCallback(
    (value?: Announcement) => {
      setReviewing(false);
      setApproval(undefined);
      setApprovalError(undefined);
      mutation.reset();
      setIdentity(dependencies.createIdentity());
      setEditor(value ? announcementEditor(value) : emptyAnnouncement(dependencies.createReference('announcement')));
    },
    [dependencies, mutation]
  );
  const command = useMemo(() => notificationCommand(editor, resolved, identity), [editor, identity, resolved]);
  const prepare = useCallback(async () => {
    if (!command || resolved.error) return;
    setApprovalError(undefined);
    try {
      setApproval(await dependencies.prepare.execute(context, command));
    } catch (cause) {
      setApprovalError(presentError(cause).message);
    }
  }, [command, context, dependencies, resolved.error]);
  const submit = useCallback(() => {
    if (!command || resolved.error || context.session.assurance.level < 3 || !editor?.confirmed || !/^[A-Za-z0-9_-]{43,128}$/.test(editor.proof) || mutation.isPending) return;
    mutation.mutate(command);
  }, [command, context.session.assurance.level, editor, mutation, resolved.error]);
  const close = useCallback(() => {
    if (!mutation.isPending) {
      setEditor(undefined);
      setReviewing(false);
      setApproval(undefined);
    }
  }, [mutation.isPending]);
  const actions = useMemo(
    () =>
      Object.freeze({
        section: changeSection,
        create: () => (section === 'announcements' ? openAnnouncement() : openTemplate()),
        editTemplate: (value: NotificationTemplate) => openTemplate(value, 'status'),
        reviseTemplate: (value: NotificationTemplate) => openTemplate(value, 'revise'),
        editAnnouncement: openAnnouncement,
        preview: () => {
          if (!resolved.error) setReviewing(true);
        },
        revise: () => setReviewing(false),
        prepare: () => void prepare(),
        submit,
        close,
        refresh: () => void refetch(),
        next: (value: string) => setSearch(pageCursor(search, value)),
        first: () =>
          setSearch((current) => {
            const next = new URLSearchParams(current);
            next.delete('cursor');
            return next;
          }),
        stepup: requestStepup,
        dismissReceipt: () => setReceipt(undefined),
        channel: (channel: NotificationChannel) => update({ channel }),
        eventType: (eventType: string) => update({ eventType }),
        variables: (variables: string) => update({ variables }),
        samples: (samples: string) => update({ samples }),
        providerTemplate: (providerTemplate: string) => update({ providerTemplate }),
        subject: (subject: string) => update({ subject }),
        title: (title: string) => update({ title }),
        body: (body: string) => update({ body }),
        purpose: (purpose: NotificationPurpose) => update({ purpose, ...(purpose === 'marketing' ? { mandatory: false } : {}) }),
        mandatory: (mandatory: boolean) => update({ mandatory }),
        templateStatus: (status: TemplateStatus) => update({ status }),
        announcementState: (state: AnnouncementState) => update({ state }),
        audience: (audience: AnnouncementEditor['audience']) => update({ audience }),
        members: (members: string) => update({ members }),
        startsAt: (startsAt: string) => update({ startsAt }),
        endsAt: (endsAt: string) => update({ endsAt }),
        proof: (proof: string) => setEditor((current) => (current ? { ...current, proof: proof.trim() } : current)),
        confirmed: (confirmed: boolean) => setEditor((current) => (current ? { ...current, confirmed } : current)),
      }),
    [changeSection, close, openAnnouncement, openTemplate, prepare, refetch, requestStepup, resolved.error, search, section, setSearch, submit, update]
  );
  const page = query.data;
  return Object.freeze({
    section,
    cursor,
    templates: section === 'announcements' ? undefined : (page as TemplatePage | undefined),
    announcements: section === 'announcements' ? (page as AnnouncementPage | undefined) : undefined,
    editor,
    reviewing,
    preview: resolved.preview,
    receipt,
    approval: Object.freeze({ request: approval, error: approvalError }),
    validation: resolved.error,
    assurance: context.session.assurance.level,
    canManage: canUseOperation(context, section === 'announcements' ? OP_NOTIFICATION_ANNOUNCEMENTS_MANAGE : OP_NOTIFICATION_TEMPLATES_MANAGE),
    condition: queryCondition({ pending: query.isPending, fetching: query.isFetching, error: query.error, hasData: page !== undefined, empty: page?.items.length === 0 }),
    error: safeQueryError(query.error),
    fetching: query.isFetching,
    saving: Object.freeze({ busy: mutation.isPending, error: safeQueryError(mutation.error) }),
    actions,
  });
}

export type NotificationViewModel = ReturnType<typeof useNotificationViewModel>;
