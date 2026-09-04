import type { Experience, ExperienceDetail, ExperiencePage, ExperienceVersion, PublicationReceipt, VersionValidation } from '../model/Experience';
import { deepFreeze } from '../../../shared/model/Immutable';
import { parseStorefrontEntryUrl, parseStorefrontHandle } from '@shop/contract';
import { STOREFRONT_ENTRY_PATH } from '@shop/config/client';
import { appConfig } from '../../../shared/config/AppConfig';
import { ExperienceCopySchema, ExperienceDetailSchema, ExperiencePageSchema, ExperiencePublicationSchema, ExperienceValidationSchema, ExperienceVersionSchema } from './ExperienceSchema';

export class ExperienceMapper {
  page(value: unknown): ExperiencePage {
    const page = ExperiencePageSchema.parse(value);
    page.items.forEach(verifyEntry);
    return deepFreeze({ items: page.items, count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  detail(value: unknown): ExperienceDetail {
    const application = ExperienceDetailSchema.parse(value);
    verifyEntry(application);
    return deepFreeze(application);
  }
  copied(value: unknown): Experience {
    const application = ExperienceCopySchema.parse(value);
    verifyEntry(application);
    return deepFreeze(application);
  }
  version(value: unknown): ExperienceVersion {
    return deepFreeze(ExperienceVersionSchema.parse(value));
  }
  validation(value: unknown): VersionValidation {
    return deepFreeze(ExperienceValidationSchema.parse(value));
  }
  publication(value: unknown): PublicationReceipt {
    return deepFreeze(ExperiencePublicationSchema.parse(value));
  }
}

function verifyEntry(application: Experience): void {
  const handle = parseStorefrontHandle(application.entry.handle);
  if (handle !== application.publicSlug) throw new Error('STOREFRONT_ENTRY_HANDLE_MISMATCH');
  parseStorefrontEntryUrl(application.entry.url, appConfig.storefrontOrigin, STOREFRONT_ENTRY_PATH, handle);
}
