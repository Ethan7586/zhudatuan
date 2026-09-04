import { RuntimeTask, type RuntimeTaskData } from './Task';

export class ExportTask extends RuntimeTask {
  constructor(value: Omit<RuntimeTaskData, 'type'>) {
    super(Object.freeze({ ...value, type: 'export' }));
  }
}
