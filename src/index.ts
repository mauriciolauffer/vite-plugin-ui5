import type { PluginOption, Plugin } from "vite";
import { loadUI5Config, type UI5PluginOptions } from "./config.js";
import { createUI5Resolver, UI5_ESM_MODULE_PREFIX } from "./resolver.js";
import { createUI5Middleware } from "./middleware.js";
import path from "node:path";
import * as babel from "@babel/core";

export function ui5(options: UI5PluginOptions = {}): PluginOption[] {
  // Initial load using cwd — used only to suggest root in config().
  const initial = loadUI5Config(options);

  // Re-resolved in configResolved once Vite's final root is known.
  // If the user set root explicitly, their value wins over the plugin suggestion.
  let resolved = initial;
  let middleware = createUI5Middleware({
    cdnBaseUrl: initial.cdnBaseUrl,
    webappDir: initial.webappDir,
    isESM: initial.isESM,
  });
  let resolver = createUI5Resolver({
    appNamespace: initial.appNamespace,
    webappDir: initial.webappDir,
    aliases: options.aliases,
  });

  const mainPlugin: Plugin = {
    name: "vite-plugin-ui5",
    enforce: "pre",

    config() {
      return {
        root: initial.webappDir,
        resolve: {
          alias: {
            [initial.appNamespace.replace(/\./g, "/")]: initial.webappDir,
            ...options.aliases,
          },
        },
      };
    },

    configResolved(config) {
      // If the user set root explicitly it differs from what the plugin suggested.
      // Re-run loadUI5Config with webappPath overridden to the user's root so all
      // derived values (appNamespace, resourceRoots, manifest) stay consistent.
      if (config.root !== initial.webappDir) {
        resolved = loadUI5Config({ ...options, webappPath: config.root });
        middleware = createUI5Middleware({
          cdnBaseUrl: resolved.cdnBaseUrl,
          webappDir: resolved.webappDir,
          isESM: resolved.isESM,
        });
        resolver = createUI5Resolver({
          appNamespace: resolved.appNamespace,
          webappDir: resolved.webappDir,
          aliases: options.aliases,
        });
      }
    },

    configureServer(server) {
      middleware(server);
      // Vite only watches files it resolves as modules. Since the middleware
      // intercepts all files in webappDir before Vite registers them, we add
      // webappDir explicitly so the watcher fires on any change there.
      server.watcher.add(resolved.webappDir);
    },

    async transform(code, id) {
      if (id.endsWith(".view.xml") || id.endsWith(".fragment.xml")) {
        const escapedCode = JSON.stringify(code);
        return { code: `export default ${escapedCode};`, map: null };
      }

      // When isESM is true, transpile app files from ESM to AMD using
      // babel-plugin-transform-modules-ui5 so the UI5 loader can handle them.
      if (resolved.isESM && (id.endsWith(".js") || id.endsWith(".ts"))) {
        const rel = path.relative(resolved.webappDir, id);
        const isInWebappDir = rel && !rel.startsWith("..") && !path.isAbsolute(rel);
        if (!isInWebappDir) return null;

        const result = await babel.transformAsync(code, {
          filename: id,
          plugins: [["babel-plugin-transform-modules-ui5", { noWrapBeforeImport: true }]],
          presets: id.endsWith(".ts") ? ["@babel/preset-typescript"] : [],
          sourceMaps: true,
          configFile: false,
          babelrc: false,
        });

        if (!result?.code) return null;
        return { code: result.code, map: (result.map as any) ?? null };
      }

      return null;
    },

    load(id) {
      if (!id.startsWith(UI5_ESM_MODULE_PREFIX)) {
        return null;
      }

      const moduleName = id.slice(UI5_ESM_MODULE_PREFIX.length);

      return `
const moduleExport = await new Promise((resolve, reject) => {
  sap.ui.require([${JSON.stringify(moduleName)}], resolve, reject);
});

export default moduleExport;
`;
    },

    handleHotUpdate({ file, server }) {
      const rel = path.relative(resolved.webappDir, file);
      const isInWebappDir = rel && !rel.startsWith("..") && !path.isAbsolute(rel);

      if (isInWebappDir) {
        server.ws.send({ type: "full-reload", path: "*" });
        return [];
      }
      return undefined;
    },
  };

  const resolverPlugin: Plugin = {
    name: "vite-plugin-ui5:resolver",
    enforce: "pre",
    resolveId(source) {
      return resolver.resolveId(source);
    },
  };

  return [mainPlugin, resolverPlugin];
}

export default ui5;
export { loadUI5Config } from "./config.js";
export { createUI5Resolver } from "./resolver.js";
export { createUI5Middleware } from "./middleware.js";
