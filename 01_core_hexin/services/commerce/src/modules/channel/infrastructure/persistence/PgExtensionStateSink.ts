import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ExtensionStateSink } from '../../../extension/ExtensionModule';

export class PgExtensionStateSink implements ExtensionStateSink {
  async degrade(database:OperationDatabase,id:string,scope:string):Promise<void> {
    await database.query(`update channel.connection set status='degraded',version=version+1,updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and status='enabled'`,[id,scope]);
  }
}
