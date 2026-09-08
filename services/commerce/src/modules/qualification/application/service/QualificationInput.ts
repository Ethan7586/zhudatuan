import { DomainError } from '../../../../platform/error/DomainError';
import { textField } from '../../../../pipeline/Validation';
import type { EvidenceKind } from '../../domain/model/Evidence';
import type { QualificationTarget, QualificationTargetKind } from '../../domain/model/QualificationCase';

export interface EvidenceInput {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly reference: string;
  readonly sha256: string;
}

export function targetInput(value: unknown, field: string): QualificationTarget {
  const item = record(value, field);
  const kind = textField(item, 'kind') as QualificationTargetKind;
  if (!['partner', 'product', 'category', 'region'].includes(kind)) invalid(field);
  return Object.freeze({ kind, id: textField(item, 'id') });
}

export function targetList(value: unknown): readonly QualificationTarget[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) invalid('applicability');
  return Object.freeze(value.map((item) => targetInput(item, 'applicability')));
}

export function evidenceInput(value: unknown): readonly EvidenceInput[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) invalid('evidence');
  return Object.freeze(
    value.map((candidate) => {
      const item = record(candidate, 'evidence');
      const kind = textField(item, 'kind') as EvidenceKind;
      if (!['license', 'certificate', 'authorization', 'agreement', 'other'].includes(kind)) invalid('evidence');
      return Object.freeze({ id: textField(item, 'id'), kind, reference: textField(item, 'reference', 2047), sha256: textField(item, 'sha256', 64) });
    })
  );
}

export function dateInput(value: unknown, field: string, fallback?: string): string {
  const selected = value === undefined ? fallback : value;
  if (typeof selected !== 'string' || Number.isNaN(Date.parse(selected))) invalid(field);
  return new Date(selected).toISOString();
}

function record(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid(field);
  return value as Readonly<Record<string, unknown>>;
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
