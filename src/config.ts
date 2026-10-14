import fs from "node:fs";
import path from "node:path";
import yaml from "yaml";

/** UI5 framework configuration from the `framework` key in `ui5.yaml`. */
export interface UI5FrameworkConfig {
  name: "SAPUI5" | "OpenUI5";
  version?: string;
  libraries?: Array<{ name: string }>;
}

/** Parsed representation of a `ui5.yaml` project descriptor file. */
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
}

/** Options accepted by the `ui5()` Vite plugin factory. */
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

/**
 * Reads and resolves all configuration needed by the plugin from `ui5.yaml`,
 * `manifest.json`, and the provided `options`.
 *
 * - `ui5YamlPath` is resolved relative to `cwd`.
 * - `appNamespace` is taken from `manifest.json`'s `sap.app.id`, falling back
 *   to `metadata.name` in `ui5.yaml`, and finally `"my.app"`.
 */
export function loadUI5Config(options: UI5PluginOptions = {}): {
  projectConfig: UI5ProjectConfig;
  appNamespace: string;
  webappDir: string;
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

  const resourceRoots: Record<string, string> = {
    [appNamespace]: "/",
    ...options.resourceRoots,
  };

  return {
    projectConfig,
    appNamespace,
    webappDir,
    resourceRoots,
    isESM,
  };
}
