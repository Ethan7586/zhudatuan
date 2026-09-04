import { OP_QUALIFICATION_EVIDENCEUPLOADS_CREATE, OP_QUALIFICATION_QUALIFICATIONS_PUBLISH, OP_QUALIFICATION_QUALIFICATIONS_REVOKE } from '@shop/contract/ids';
import { presentError } from '@shop/presentation';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { QualificationDependencies } from '../../../../app/Dependencies';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { EvidenceKind, QualificationCase, QualificationTarget, QualificationTargetKind, UploadedEvidence } from '../model/Qualification';

export type QualificationCaseEditor =
  | Readonly<{
      kind: 'publish';
      id: string;
      title: string;
      subjectKind: QualificationTargetKind;
      subjectId: string;
      applicability: string;
      evidenceKind: EvidenceKind;
      evidence: UploadedEvidence | undefined;
      effectiveAt: string;
      expiresAt: string;
      proof: string;
      confirmed: boolean;
    }>
  | Readonly<{ kind: 'revoke'; qualification: QualificationCase; reason: string; proof: string; confirmed: boolean }>;

export function useQualificationCaseViewModel(
  context: ConsoleContext,
  dependencies: QualificationDependencies,
  requestStepup: () => void,
  refresh: () => Promise<unknown>
) {
  const [editor, setEditor] = useState<QualificationCaseEditor>();
  const [identity, setIdentity] = useState(dependencies.createIdentity);
  const [receipt, setReceipt] = useState<QualificationCase>();
  const upload = useMutation({
    mutationFn: ({ file, kind }: Readonly<{ file: File; kind: EvidenceKind }>) => dependencies.upload.execute(context, file, kind, identity),
    onSuccess: (evidence) => setEditor((current) => (current?.kind === 'publish' ? { ...current, evidence } : current)),
  });
  const publish = useMutation({
    mutationFn: (current: Extract<QualificationCaseEditor, { kind: 'publish' }>) =>
      dependencies.publish.execute(context, {
        id: current.id,
        title: current.title.trim(),
        subject: { kind: current.subjectKind, id: current.subjectId.trim() },
        applicability: targets(current.applicability),
        evidence: current.evidence ? [{ id: current.evidence.id, kind: current.evidence.kind, reference: current.evidence.reference, sha256: current.evidence.sha256 }] : [],
        ...(current.effectiveAt ? { effectiveAt: new Date(current.effectiveAt).toISOString() } : {}),
        expiresAt: new Date(current.expiresAt).toISOString(),
        expectedVersion: 0,
        proof: current.proof,
        identity,
      }),
    onSuccess: async (value) => completed(value),
  });
  const revoke = useMutation({
    mutationFn: (current: Extract<QualificationCaseEditor, { kind: 'revoke' }>) =>
      dependencies.revoke.execute(context, { qualification: current.qualification, reason: current.reason.trim(), proof: current.proof, identity }),
    onSuccess: async (value) => completed(value),
  });
  const completed = async (value: QualificationCase) => {
    await refresh();
    setReceipt(value);
    setEditor(undefined);
  };
  const busy = upload.isPending || publish.isPending || revoke.isPending;
  const validation = validate(editor, context.session.assurance.level);
  const update = (change: Partial<QualificationCaseEditor>) => {
    if (!busy) setEditor((current) => (current ? ({ ...current, ...change, proof: '', confirmed: false } as QualificationCaseEditor) : current));
  };
  return Object.freeze({
    editor,
    receipt,
    busy,
    validation,
    assurance: context.session.assurance.level,
    canPublish: canUseOperation(context, OP_QUALIFICATION_QUALIFICATIONS_PUBLISH),
    canRevoke: canUseOperation(context, OP_QUALIFICATION_QUALIFICATIONS_REVOKE),
    canUpload: canUseOperation(context, OP_QUALIFICATION_EVIDENCEUPLOADS_CREATE),
    error: [upload.error, publish.error, revoke.error].find(Boolean) ? presentError([upload.error, publish.error, revoke.error].find(Boolean)).message : undefined,
    actions: Object.freeze({
      openPublish: () => {
        const tomorrow = new Date(Date.now() + 365 * 86_400_000);
        setEditor({
          kind: 'publish',
          id: dependencies.createQualificationReference(),
          title: '',
          subjectKind: 'partner',
          subjectId: '',
          applicability: '',
          evidenceKind: 'license',
          evidence: undefined,
          effectiveAt: '',
          expiresAt: localDate(tomorrow),
          proof: '',
          confirmed: false,
        });
        setIdentity(dependencies.createIdentity());
      },
      openRevoke: (qualification: QualificationCase) => {
        setEditor({ kind: 'revoke', qualification, reason: '', proof: '', confirmed: false });
        setIdentity(dependencies.createIdentity());
      },
      close: () => {
        if (!busy) setEditor(undefined);
      },
      upload: (file: File) => editor?.kind === 'publish' && upload.mutate({ file, kind: editor.evidenceKind }),
      submit: () => {
        if (validation || !editor || busy) return;
        if (editor.kind === 'publish') publish.mutate(editor);
        else revoke.mutate(editor);
      },
      update,
      proof: (value: string) => setEditor((current) => (current ? { ...current, proof: value.trim() } : current)),
      confirmed: (confirmed: boolean) => setEditor((current) => (current ? { ...current, confirmed } : current)),
      stepup: requestStepup,
      dismissReceipt: () => setReceipt(undefined),
    }),
  });
}

function validate(editor: QualificationCaseEditor | undefined, assurance: number): string | undefined {
  if (!editor) return undefined;
  if (editor.kind === 'revoke') {
    if (editor.reason.trim().length < 2) return '请填写不少于 2 个字符的撤销原因。';
  } else {
    if (!editor.title.trim()) return '请填写资质名称。';
    if (!editor.subjectId.startsWith(`${editor.subjectKind}:`)) return `主体标识应以 ${editor.subjectKind}: 开头。`;
    try {
      if (targets(editor.applicability).length === 0) return '请至少填写一个适用对象。';
    } catch {
      return '适用对象需逐行填写 product:、category:、region: 或 partner: 开头的标识。';
    }
    if (!editor.evidence) return '请先选择并上传一份资质材料。';
    if (!editor.expiresAt || Date.parse(editor.expiresAt) <= Date.now()) return '失效时间必须晚于当前时间。';
  }
  if (assurance < 3) return '提交前请完成高强度二次验证。';
  if (!proof(editor.proof)) return '请粘贴 Step-up 签发的一次性操作凭证。';
  if (!editor.confirmed) return '请确认已核对材料、适用范围与生效时间。';
  return undefined;
}

function targets(source: string): readonly QualificationTarget[] {
  const values = source.split(/[\n,，]/).map((value) => value.trim()).filter(Boolean);
  const result = values.map((id) => {
    const kind = id.split(':', 1)[0] as QualificationTargetKind;
    if (!['partner', 'product', 'category', 'region'].includes(kind) || !id.startsWith(`${kind}:`)) throw new Error('QUALIFICATION_TARGET_INVALID');
    return Object.freeze({ kind, id });
  });
  if (new Set(result.map((item) => `${item.kind}:${item.id}`)).size !== result.length || result.length > 100) throw new Error('QUALIFICATION_TARGET_INVALID');
  return Object.freeze(result);
}

function proof(value: string): boolean {
  return /^[A-Za-z0-9_-]{43,128}$/.test(value);
}

function localDate(value: Date): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

export type QualificationCaseViewModel = ReturnType<typeof useQualificationCaseViewModel>;
