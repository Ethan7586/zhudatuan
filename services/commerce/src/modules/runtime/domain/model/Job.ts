import { RuntimeTask, type RuntimeTaskData } from './Task';

export class Job extends RuntimeTask {
  constructor(value: Omit<RuntimeTaskData, 'type'>) {
    super(Object.freeze({ ...value, type: 'job' }));
  }
}
