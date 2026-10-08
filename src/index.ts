import type { PluginOption, Plugin, IndexHtmlTransformResult } from "vite";
import { loadUI5Config, type UI5PluginOptions } from "./config.js";
import { createUI5Resolver, UI5_ESM_MODULE_PREFIX } from "./resolver.js";
import { createUI5Middleware } from "./middleware.js";

export function ui5(options: UI5PluginOptions = {}): PluginOption[] {
  const { appNamespace, webappDir, cdnBaseUrl, resourceRoots } = loadUI5Config(options);
  const resolver = createUI5Resolver({ appNamespace, webappDir, aliases: options.aliases });
  const middleware = createUI5Middleware({ cdnBaseUrl, webappDir });

  const mainPlugin: Plugin = {
    name: "vite-plugin-ui5",
    enforce: "pre",

    config() {
      return {
        resolve: {
          alias: {
            [appNamespace.replace(/\./g, "/")]: webappDir,
            ...options.aliases,
          },
        },
      };
    },

    configureServer(server) {
      middleware(server);
    },

    transformIndexHtml: {
      // Run before Vite analyzes scripts in index.html. UI5's bootstrap is a
      // classic script, so Vite must not turn it into a module entry point.
      order: "pre",
      handler(html): IndexHtmlTransformResult {
        const resourceRootsJson = JSON.stringify(resourceRoots).replace(/'/g, "&#39;");

        return html.replace(/<script\b(?=[^>]*\bid=(["'])sap-ui-bootstrap\1)[^>]*>/i, (tag) => {
          let transformedTag = tag;

          if (!/\bdata-sap-ui-resourceroots\s*=/i.test(transformedTag)) {
            transformedTag = transformedTag.replace(
              />$/,
              ` data-sap-ui-resourceroots='${resourceRootsJson}'>`,
            );
          }

          if (!/\svite-ignore(?:\s|=|>)/i.test(transformedTag)) {
            transformedTag = transformedTag.replace(/>$/, " vite-ignore>");
          }

          return transformedTag;
        });
      },
    },

    transform(code, id) {
      // Transform XML View / Fragment files if imported in JS/TS
      if (id.endsWith(".view.xml") || id.endsWith(".fragment.xml")) {
        const escapedCode = JSON.stringify(code);
        return {
          code: `export default ${escapedCode};`,
          map: null,
        };
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
      // Trigger HMR reloads for XML views, controller changes, and i18n properties
      if (
        file.endsWith(".view.xml") ||
        file.endsWith(".fragment.xml") ||
        file.endsWith(".controller.js") ||
        file.endsWith(".controller.ts") ||
        file.endsWith(".properties")
      ) {
        server.ws.send({
          type: "full-reload",
          path: "*",
        });
        return [];
      }
      return undefined;
    },
  };

  return [mainPlugin, resolver as Plugin];
}

export default ui5;
export { loadUI5Config } from "./config.js";
export { createUI5Resolver } from "./resolver.js";
export { createUI5Middleware } from "./middleware.js";
