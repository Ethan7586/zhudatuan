import { auditJobs } from '../check/callgraph/jobs.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';

const context = graphContext();
report('jobs', auditJobs(context.sourceFiles, context.production));

