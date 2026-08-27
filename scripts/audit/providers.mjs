import { extensionViolations } from './extensions.mjs';
import { report } from './report.mjs';

report('providers', extensionViolations());

