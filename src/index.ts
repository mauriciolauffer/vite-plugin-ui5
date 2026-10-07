import type { PluginOption, Plugin, IndexHtmlTransformResult } from "vite";
import fs from "node:fs";
import path from "node:path";
import { loadUI5Config, type UI5PluginOptions } from "./config.js";
import { createUI5Resolver } from "./resolver.js";
import { createUI5Middleware } from "./middleware.js";

export function ui5(options: UI5PluginOptions = {}): PluginOption[] {
  const { projectConfig, appNamespace, webappDir, cdnBaseUrl, resourceRoots } = loadUI5Config(options);
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
            ...(options.aliases || {})
          }
        }
      };
    },

    configureServer(server) {
      middleware(server);
    },

    transformIndexHtml(html): IndexHtmlTransformResult {
      // Ensure resourceRoots attribute is injected safely into bootstrap script tag
      const resourceRootsJson = JSON.stringify(resourceRoots).replace(/'/g, "&#39;");

      if (html.includes('data-sap-ui-resourceroots=')) {
        return html;
      }

      if (html.includes('id="sap-ui-bootstrap"')) {
        return html.replace(
          'id="sap-ui-bootstrap"',
          `id="sap-ui-bootstrap" data-sap-ui-resourceroots='${resourceRootsJson}'`
        );
      }

      return html;
    },

    transform(code, id) {
      // Transform XML View / Fragment files if imported in JS/TS
      if (id.endsWith(".view.xml") || id.endsWith(".fragment.xml")) {
        const escapedCode = JSON.stringify(code);
        return {
          code: `export default ${escapedCode};`,
          map: null
        };
      }

      // Transform UI5 modules (sap/*) into ESM compatible exports if imported as ES modules
      if (id.includes("/resources/sap/")) {
        const moduleName = id.split("/resources/")[1]?.replace(/\.js$/, "");
        if (moduleName) {
          const transformedCode = `${code}\n/* vite-plugin-ui5 ESM export shim */\nexport default (typeof sap !== 'undefined' && sap.ui && sap.ui.require) ? sap.ui.require('${moduleName}') : undefined;\n`;
          return {
            code: transformedCode,
            map: null
          };
        }
      }

      return null;
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
          path: "*"
        });
        return [];
      }
      return undefined;
    }
  };

  return [mainPlugin, resolver as Plugin];
}

export default ui5;
export { loadUI5Config } from "./config.js";
export { createUI5Resolver } from "./resolver.js";
export { createUI5Middleware } from "./middleware.js";
