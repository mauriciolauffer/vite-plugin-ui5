import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

export interface UI5FrameworkConfig {
  name: "SAPUI5" | "OpenUI5";
  version?: string;
  libraries?: Array<{ name: string }>;
}

export interface UI5ProjectConfig {
  specVersion?: string;
  type?: string;
  metadata?: {
    name?: string;
  };
  framework?: UI5FrameworkConfig;
  server?: {
    customMiddleware?: Array<Record<string, unknown>>;
  };
  appNamespace?: string;
  webappPath?: string;
  cdnUrl?: string;
}

export interface UI5PluginOptions {
  /**
   * Path to project root directory. Defaults to process.cwd()
   */
  root?: string;
  /**
   * Path to ui5.yaml relative to root. Defaults to 'ui5.yaml'
   */
  ui5YamlPath?: string;
  /**
   * Path to webapp directory relative to root. Defaults to 'webapp'
   */
  webappPath?: string;
  /**
   * Custom CDN base URL for UI5 resources
   */
  cdnUrl?: string;
  /**
   * Custom resource roots overrides
   */
  resourceRoots?: Record<string, string>;
  /**
   * Custom path aliases
   */
  aliases?: Record<string, string>;
}

export function loadUI5Config(options: UI5PluginOptions = {}): {
  projectConfig: UI5ProjectConfig;
  appNamespace: string;
  webappDir: string;
  cdnBaseUrl: string;
  resourceRoots: Record<string, string>;
} {
  const root = options.root || process.cwd();
  const ui5YamlPath = path.resolve(root, options.ui5YamlPath || "ui5.yaml");
  const webappDir = path.resolve(root, options.webappPath || "webapp");
  const manifestPath = path.resolve(webappDir, "manifest.json");

  let projectConfig: UI5ProjectConfig = {};

  if (fs.existsSync(ui5YamlPath)) {
    try {
      const fileContent = fs.readFileSync(ui5YamlPath, "utf-8");
      projectConfig = YAML.parse(fileContent) || {};
    } catch (e) {
      console.warn(`[vite-plugin-ui5] Warning: Failed to parse ${ui5YamlPath}`, e);
    }
  }

  let appNamespace = projectConfig.metadata?.name || "my.app";

  if (fs.existsSync(manifestPath)) {
    try {
      const manifestContent = fs.readFileSync(manifestPath, "utf-8");
      const manifestJson = JSON.parse(manifestContent);
      if (manifestJson["sap.app"]?.id) {
        appNamespace = manifestJson["sap.app"].id;
      }
    } catch (e) {
      console.warn(`[vite-plugin-ui5] Warning: Failed to parse ${manifestPath}`, e);
    }
  }

  const frameworkName = projectConfig.framework?.name || "SAPUI5";
  const defaultCdn =
    frameworkName === "OpenUI5"
      ? "https://sdk.openui5.org"
      : "https://ui5.sap.com";

  const cdnBaseUrl = options.cdnUrl || defaultCdn;

  const resourceRoots: Record<string, string> = {
    [appNamespace]: "/",
    ...(options.resourceRoots || {})
  };

  return {
    projectConfig,
    appNamespace,
    webappDir,
    cdnBaseUrl,
    resourceRoots
  };
}
