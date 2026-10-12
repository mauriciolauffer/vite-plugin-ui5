import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

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
  resources?: {
    configuration?: {
      paths?: {
        webapp?: string;
      };
    };
  };
  server?: {
    customMiddleware?: Array<Record<string, unknown>>;
  };
  appNamespace?: string;
  webappPath?: string;
  cdnUrl?: string;
}

export interface UI5PluginOptions {
  /**
   * Path to ui5.yaml relative to cwd. Defaults to 'ui5.yaml'
   */
  ui5YamlPath?: string;
  /**
   * Path to webapp directory relative to cwd. Defaults to the value from
   * ui5.yaml resources.configuration.paths.webapp, or 'webapp'.
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
  /**
   * Set to true when the app uses native ES module syntax (import/export, ES classes).
   * The plugin will use babel-plugin-transform-modules-ui5 to transpile app files to
   * AMD (sap.ui.define) at dev/build time so the UI5 loader can handle them at runtime.
   * Defaults to false (app already written in classic AMD style).
   */
  isESM?: boolean;
}

export function loadUI5Config(options: UI5PluginOptions = {}): {
  projectConfig: UI5ProjectConfig;
  appNamespace: string;
  webappDir: string;
  cdnBaseUrl: string;
  resourceRoots: Record<string, string>;
  isESM: boolean;
} {
  const cwd = process.cwd();
  const ui5YamlPath = path.resolve(cwd, options.ui5YamlPath || "ui5.yaml");

  let projectConfig: UI5ProjectConfig = {};

  if (fs.existsSync(ui5YamlPath)) {
    try {
      const fileContent = fs.readFileSync(ui5YamlPath, "utf-8");
      projectConfig = yaml.parse(fileContent) || {};
    } catch (e) {
      console.warn(`[vite-plugin-ui5] Warning: Failed to parse ${ui5YamlPath}`, e);
    }
  }

  const webappPathFromYaml = projectConfig.resources?.configuration?.paths?.webapp;
  const webappDir = path.resolve(cwd, options.webappPath || webappPathFromYaml || "webapp");
  const isESM = options.isESM ?? false;
  const manifestPath = path.resolve(webappDir, "manifest.json");

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

  const cdnBaseUrl = options.cdnUrl || "https://ui5.sap.com";

  const resourceRoots: Record<string, string> = {
    [appNamespace]: "/",
    ...options.resourceRoots,
  };

  return {
    projectConfig,
    appNamespace,
    webappDir,
    cdnBaseUrl,
    resourceRoots,
    isESM,
  };
}
