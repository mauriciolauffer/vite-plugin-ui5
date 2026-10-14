import fs from "node:fs";
import path from "node:path";

/** Options accepted by the `ui5()` Vite plugin factory. */
export interface UI5PluginOptions {
  /**
   * Path to webapp directory relative to cwd. Defaults to 'webapp'.
   */
  webappPath?: string;
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
 * Resolves all configuration needed by the plugin from `manifest.json` and
 * the provided `options`.
 *
 * - `appNamespace` is taken from `manifest.json`'s `sap.app.id`, falling back
 *   to `"my.app"`.
 */
export function loadUI5Config(options: UI5PluginOptions = {}): {
  appNamespace: string;
  webappDir: string;
  isESM: boolean;
} {
  const cwd = process.cwd();
  const webappDir = path.resolve(cwd, options.webappPath || "webapp");
  const isESM = options.isESM ?? false;
  const manifestPath = path.resolve(webappDir, "manifest.json");

  let appNamespace = "my.app";

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

  return {
    appNamespace,
    webappDir,
    isESM,
  };
}
