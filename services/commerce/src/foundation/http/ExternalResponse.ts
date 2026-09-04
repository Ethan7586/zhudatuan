import { Failure, statusFailure } from '../domain/Failure';

export function requireExternalResponse(response: Pick<Response, 'ok' | 'status'>, code: string): void {
  if (!response.ok) throw statusFailure(code, response.status);
}

export async function readExternalJson(
  response: Response,
  unavailableCode: string,
  invalidCode: string
): Promise<unknown> {
  requireExternalResponse(response, unavailableCode);
  try {
    return await response.json();
  } catch (cause) {
    throw new Failure(invalidCode, 'response', false, response.status, { cause });
  }
}

export function invalidExternalResponse(code: string, cause?: unknown): Failure {
  return new Failure(code, 'response', false, undefined, cause === undefined ? undefined : { cause });
}
