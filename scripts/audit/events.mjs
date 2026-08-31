import { auditEvents } from '../check/callgraph/events.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';

const context = graphContext();
report('events', auditEvents(context.production));
