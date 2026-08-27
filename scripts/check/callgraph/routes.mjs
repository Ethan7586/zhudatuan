import path from 'node:path';

import { relative, ts } from '../source.mjs';
import { literalText, objectProperties, violation } from './catalog.mjs';

export function auditRoutes(sourceFiles, production = new Set(sourceFiles.keys())) {
  const values = [];
  for (const [file, sourceFile] of sourceFiles) {
    if (!production.has(file)) continue;
    if (!relative(file).startsWith('apps/')) continue;
    const routeRegistry = /(?:route|router|navigation)/i.test(path.basename(file));
    const visit = (node) => {
      if (routeRegistry && ts.isObjectLiteralExpression(node)) {
        const properties = objectProperties(node, sourceFile);
        const route = literalText(properties.get('path'));
        if (route?.startsWith('/') && !['element', 'component', 'Component', 'lazy', 'load', 'page', 'redirect', 'loader', 'children'].some((field) => properties.has(field))) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          values.push(violation('ROUTE_PAGE_MISSING', `${relative(file)}:${position.line + 1}`, route));
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text.toLowerCase();
        const first = node.arguments[0];
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method) && first && ts.isStringLiteralLike(first) && first.text.startsWith('/') && node.arguments.length < 2) {
          const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          values.push(violation('ROUTE_HANDLER_MISSING', `${relative(file)}:${position.line + 1}`, first.text));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return values;
}
