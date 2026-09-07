/**
 * Tailwind 4 emits its core rules inside CSS cascade layers. Older Android
 * WeChat WebViews ignore those blocks completely, leaving SSR markup unstyled.
 * The generated layer order is already deterministic, so preserving source
 * order while unwrapping the blocks keeps the cascade and restores legacy use.
 */
const legacyWebviewCompatibility = {
  postcssPlugin: 'smart-wing-legacy-webview-compatibility',
  OnceExit(root) {
    let foundLayer = true;

    while (foundLayer) {
      foundLayer = false;
      root.walkAtRules('layer', (rule) => {
        foundLayer = true;
        if (!rule.nodes) {
          rule.remove();
          return;
        }

        rule.replaceWith(...rule.nodes.map((node) => node.clone()));
      });
    }
  },
};

export default legacyWebviewCompatibility;
