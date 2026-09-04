import { pathToFileURL } from 'node:url';

import { auditExtensions } from '../check/callgraph/extensions.mjs';
import { graphContext } from './graphcontext.mjs';
import { report } from './report.mjs';

export function extensionViolations() {
  const context = graphContext();
  return auditExtensions(context.sourceFiles, context.production);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) report('extensions', extensionViolations());

