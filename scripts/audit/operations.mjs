import { auditOperations } from '../check/callgraph/operations.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';

const context = graphContext();
report('operations', auditOperations(context.production, context.tests));

