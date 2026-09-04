import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ExtensionLoader, ExtensionRepositoryFactory } from '../../01_public_gongkai/ExtensionLoader';

export class DisableExtension {
  constructor(private readonly repositories:ExtensionRepositoryFactory,private readonly loader:ExtensionLoader) {}

  async execute(database:OperationDatabase,id:string,scope:string,actor:string,trace:string):Promise<string> {
    const repository=this.repositories(database); const current=await repository.lock(id,scope);
    if (!current) throw new Error('RESOURCE_NOT_FOUND');
    if (current.state!=='disabled') await repository.transition(current,'disabled',actor,{ reason:'operator disabled',trace });
    return current.extension;
  }

  finalize(provider:string,scope:string):Promise<void> { return this.loader.disable(provider,scope); }
}
