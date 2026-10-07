import fs from "node:fs";
import path from "node:path";
import type { PluginOption } from "vite";

export interface UI5ResolverOptions {
  appNamespace: string;
  webappDir: string;
  aliases?: Record<string, string>;
}

export function createUI5Resolver(options: UI5ResolverOptions) {
  const { appNamespace, webappDir, aliases = {} } = options;
  const namespacePrefix = appNamespace.replace(/\./g, "/");

  return {
    name: "vite-plugin-ui5:resolver",

    resolveId(source: string) {
      // 1. Check custom user aliases (e.g., "@app/..." -> "./webapp/...")
      for (const [aliasKey, aliasPath] of Object.entries(aliases)) {
        if (source === aliasKey || source.startsWith(aliasKey + "/")) {
          const subPath = source.slice(aliasKey.length);
          const resolved = path.resolve(webappDir, aliasPath, "." + subPath);
          if (fs.existsSync(resolved) || fs.existsSync(resolved + ".js") || fs.existsSync(resolved + ".ts")) {
            return resolved;
          }
        }
      }

      // 2. Check app namespace import (e.g. "my/app/controller/Main.controller")
      if (source.startsWith(namespacePrefix + "/")) {
        const relativePath = source.slice(namespacePrefix.length + 1);
        const fileExtensions = ["", ".js", ".ts", ".controller.js", ".controller.ts"];

        for (const ext of fileExtensions) {
          const candidate = path.resolve(webappDir, relativePath + ext);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return candidate;
          }
        }
      }

      // 3. SAP / OpenUI5 Framework module (e.g. "sap/m/Button" or "sap/ui/core/mvc/Controller")
      if (
        source.startsWith("sap/") ||
        source.startsWith("sap/ui/") ||
        source.startsWith("sap/m/") ||
        source.startsWith("sap/f/") ||
        source.startsWith("sap/tnt/") ||
        source.startsWith("sap/uxap/")
      ) {
        // Return a virtual resource path to be served by the Vite dev middleware or CDN proxy
        const cleanPath = source.replace(/\.js$/, "") + ".js";
        return `/resources/${cleanPath}`;
      }

      return null;
    }
  };
}
