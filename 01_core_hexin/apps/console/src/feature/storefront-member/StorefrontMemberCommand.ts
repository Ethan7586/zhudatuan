import { StorefrontMemberCustomProfileSchema, StorefrontMemberProfileConfigSchema, type StorefrontMemberCustomProfileUpdate, type StorefrontMemberProfileConfig } from '@shop/contract';
import { createFetchMemberStorefrontConfigManage, createFetchMemberStorefrontCustomManage } from '@shop/sdk/member';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const configManage = createFetchMemberStorefrontConfigManage(appConfig.apiBaseUrl);
const customManage = createFetchMemberStorefrontCustomManage(appConfig.apiBaseUrl);
export async function saveStorefrontMemberConfig(context: ConsoleContext, config: StorefrontMemberProfileConfig, signal?: AbortSignal) {
  return StorefrontMemberProfileConfigSchema.parse(
    await configManage(
      { body: config },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    )
  );
}
export async function saveStorefrontMemberCustomProfile(context: ConsoleContext, membershipId: string, profile: StorefrontMemberCustomProfileUpdate, signal?: AbortSignal) {
  return StorefrontMemberCustomProfileSchema.parse(
    await customManage(
      { path: { membershipid: membershipId }, body: profile },
      consoleCommand(context.scope, { accessVersion: context.session.accessVersion, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }), ...(signal === undefined ? {} : { signal }) })
    )
  );
}
