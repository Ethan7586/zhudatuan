import { RuntimeTask, type RuntimeTaskData } from './Task';

export class ImportTask extends RuntimeTask {
  constructor(value: Omit<RuntimeTaskData, 'type'>) {
    super(Object.freeze({ ...value, type: 'import' }));
  }
}
