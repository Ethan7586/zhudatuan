import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
import {
  CloneCompanyTemplate,
  type CloneCompanyTemplateInput,
  type CompanyTemplateClone,
} from './CloneCompanyTemplate';

export interface CompanyTemplateCloneApplication {
  execute(database: OperationDatabase, input: CloneCompanyTemplateInput): Promise<CompanyTemplateClone>;
}

/** Internal workflow boundary. Batch 15 only needs to map its canonical request into this input. */
export class CompanyTemplateCloneWorkflow {
  constructor(private readonly cloneCompany: CompanyTemplateCloneApplication = new CloneCompanyTemplate()) {}

  async execute(database: OperationDatabase, input: CloneCompanyTemplateInput): Promise<CompanyTemplateClone> {
    return this.cloneCompany.execute(database, input);
  }
}
