import { operationSchema } from '@shop/contract';
import {
  OP_EXPERIENCE_APPLICATIONS_COPY,
  OP_EXPERIENCE_APPLICATIONS_DETAIL_READ,
  OP_EXPERIENCE_APPLICATIONS_READ,
  OP_EXPERIENCE_VERSIONS_PUBLISH,
  OP_EXPERIENCE_VERSIONS_SAVE,
  OP_EXPERIENCE_VERSIONS_VALIDATE,
} from '@shop/contract/ids';

export const ExperienceVersionSchema = operationSchema(OP_EXPERIENCE_VERSIONS_SAVE).output;
export const ExperienceDetailSchema = operationSchema(OP_EXPERIENCE_APPLICATIONS_DETAIL_READ).output;
export const ExperiencePageSchema = operationSchema(OP_EXPERIENCE_APPLICATIONS_READ).output;
export const ExperienceCopySchema = operationSchema(OP_EXPERIENCE_APPLICATIONS_COPY).output;
export const ExperienceValidationSchema = operationSchema(OP_EXPERIENCE_VERSIONS_VALIDATE).output;
export const ExperiencePublicationSchema = operationSchema(OP_EXPERIENCE_VERSIONS_PUBLISH).output;
