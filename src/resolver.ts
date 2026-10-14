import fs from "node:fs";
import path from "node:path";

/** Options for {@link createUI5Resolver}. */
export interface UI5ResolverOptions {
  appNamespace: string;
  webappDir: string;
  aliases?: Record<string, string>;
}

/** Virtual module prefix used to wrap UI5 AMD modules as Vite ESM imports. */
export const UI5_ESM_MODULE_PREFIX = "\0vite-plugin-ui5:ui5-esm:";

/**
 * Creates a module resolver that maps UI5-style import specifiers to their
 * actual files or virtual modules:
 *
 * 1. **Custom aliases** — user-defined mappings (e.g. `"@utils"` → `"./webapp/utils"`).
 * 2. **App namespace** — dot-separated namespace converted to a path under
 *    `webappDir` (e.g. `"my/app/controller/Main"` → `<webappDir>/controller/Main.js`).
 * 3. **SAP framework modules** — `sap/*` imports are wrapped in a virtual ESM
 *    module that loads the AMD module via `sap.ui.require` at runtime.
 */
export function createUI5Resolver(options: UI5ResolverOptions) {
  const { appNamespace, webappDir, aliases = {} } = options;
  const namespacePrefix = appNamespace.replace(/\./g, "/");
  const cache = new Map<string, string | null>();

  function resolve(source: string): string | null {
    // 1. Check custom user aliases (e.g., "@app/..." -> "./webapp/...")
    for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
      if (source === aliasKey || source.startsWith(aliasKey + "/")) {
        const subPath = source.slice(aliasKey.length);
        const resolved = path.resolve(webappDir, aliasPath, "." + subPath);
        for (const candidate of [resolved, resolved + ".js", resolved + ".ts"]) {
          try {
            if (fs.statSync(candidate).isFile()) return candidate;
          } catch {
            // not found — try next
          }
        }
      }
    }

    // 2. Check app namespace import (e.g. "my/app/controller/Main.controller")
    if (source.startsWith(namespacePrefix + "/")) {
      const relativePath = source.slice(namespacePrefix.length + 1);
      const fileExtensions = ["", ".js", ".ts", ".controller.js", ".controller.ts"];

      for (const ext of fileExtensions) {
        const candidate = path.resolve(webappDir, relativePath + ext);
        try {
          if (fs.statSync(candidate).isFile()) return candidate;
        } catch {
          // not found — try next
        }
      }
      // File not found within the app namespace — do not fall through to
      // the framework resolver; return null so Vite surfaces a clear error.
      return null;
    }

    // 3. SAP / OpenUI5 Framework module (e.g. "sap/m/Button" or "sap/ui/core/mvc/Controller")
    if (source.startsWith("sap/")) {
      // Load UI5's AMD module through a Vite ESM wrapper. The wrapper first
      // registers the UI5 resource, then obtains its UI5 export.
      return `${UI5_ESM_MODULE_PREFIX}${source.replace(/\.js$/, "")}`;
    }

    return null;
  }

  return {
    name: "vite-plugin-ui5:resolver",

    resolveId(source: string) {
      if (cache.has(source)) return cache.get(source)!;

      const result = resolve(source);
      cache.set(source, result);
      return result;
    },
  };
}
