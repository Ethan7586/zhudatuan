import type { Experience, ExperienceDetail, ExperiencePage, ExperienceVersion, PublicationReceipt, VersionValidation } from '../model/Experience';
import { deepFreeze } from '../../../shared/model/Immutable';
import { ExperienceCopySchema, ExperienceDetailSchema, ExperiencePageSchema, ExperiencePublicationSchema, ExperienceSchema, ExperienceValidationSchema, ExperienceVersionSchema } from './ExperienceSchema';

export class ExperienceMapper {
  page(value: unknown): ExperiencePage {
    const page = ExperiencePageSchema.parse(value);
    return deepFreeze({ items: page.items, count: page.count, ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }) });
  }

  detail(value: unknown): ExperienceDetail {
    return deepFreeze(ExperienceDetailSchema.parse(value));
  }
  application(value: unknown): Experience {
    return deepFreeze(ExperienceSchema.parse(value));
  }
  copied(value: unknown): Experience {
    return deepFreeze(ExperienceCopySchema.parse(value));
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
