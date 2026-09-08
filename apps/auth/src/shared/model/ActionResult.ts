import type { FailureView } from '@shop/presentation';

export type ActionResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; failure: FailureView }>;

export function actionSuccess<T>(value: T): ActionResult<T> {
  return Object.freeze({ ok: true, value });
}

export function actionFailure<T>(failure: FailureView): ActionResult<T> {
  return Object.freeze({ ok: false, failure });
}
