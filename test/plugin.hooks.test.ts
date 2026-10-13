import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import ui5Plugin from "../src/index.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");
const webappDir = path.resolve(fixtureDir, "webapp");

function mainPlugin(opts: Parameters<typeof ui5Plugin>[0] = {}) {
  const plugins = ui5Plugin(opts);
  return Array.isArray(plugins) ? plugins[0] : plugins;
}

function resolverPlugin(opts: Parameters<typeof ui5Plugin>[0] = {}) {
  const plugins = ui5Plugin(opts);
  return Array.isArray(plugins) ? plugins[1] : plugins;
}

describe("plugin — factory", () => {
  it("returns an array of two plugins", () => {
    const plugins = ui5Plugin({ webappPath: webappDir });
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBe(2);
  });
});

describe("plugin — config() hook", () => {
  it("returns webappDir as root with appNamespace alias", () => {
    const result = (
      mainPlugin({
        ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
        webappPath: webappDir,
      }) as any
    ).config();
    expect(result.root).toBe(webappDir);
    expect(result.resolve.alias["test/app"]).toBe(webappDir);
  });
});

describe("plugin — configResolved() hook", () => {
  it("does not throw when Vite root matches suggested root", () => {
    const plugin = mainPlugin({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: webappDir,
    });
    expect(() => (plugin as any).configResolved({ root: webappDir })).not.toThrow();
  });

  it("re-resolves when Vite root differs from suggested root", () => {
    const plugin = mainPlugin({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: webappDir,
    });
    expect(() => (plugin as any).configResolved({ root: path.resolve(fixtureDir) })).not.toThrow();
  });
});

describe("plugin — configureServer() hook", () => {
  it("registers middleware and watches webappDir", () => {
    const plugin = mainPlugin({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: webappDir,
    });
    const add = vi.fn();
    const use = vi.fn();
    (plugin as any).configureServer({ middlewares: { use }, watcher: { add } });
    expect(use).toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith(webappDir);
  });
});

describe("plugin — transform() hook", () => {
  it("transforms .view.xml to ESM string export", async () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    const xmlContent = '<mvc:View xmlns:mvc="sap.ui.core.mvc"></mvc:View>';
    const result = await (plugin as any).transform(xmlContent, "/path/Main.view.xml");
    expect(result.code).toContain("export default");
    expect(result.code).toContain(JSON.stringify(xmlContent));
  });

  it("transforms .fragment.xml to ESM string export", async () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    const result = await (plugin as any).transform(
      "<core:FragmentDefinition/>",
      "/path/Dialog.fragment.xml",
    );
    expect(result.code).toContain("export default");
  });

  it("returns null for non-matching file types", async () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    expect(await (plugin as any).transform("body {}", "/path/styles.css")).toBeNull();
  });

  it("does not add ESM syntax to UI5 resources", async () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    expect(
      await (plugin as any).transform("sap.ui.define([]);", "/resources/sap-ui-core.js"),
    ).toBeNull();
  });
});

describe("plugin — load() hook", () => {
  it("returns null for non-UI5-ESM ids", () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    expect((plugin as any).load("/some/regular/file.js")).toBeNull();
  });

  it("generates sap.ui.require wrapper for UI5 ESM prefix", () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    const result = (plugin as any).load("\0vite-plugin-ui5:ui5-esm:sap/m/Button");
    expect(result).toContain('sap.ui.require(["sap/m/Button"]');
    expect(result).toContain("export default moduleExport");
  });
});

describe("plugin — handleHotUpdate() hook", () => {
  it("triggers full reload for files inside webappDir", () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    const send = vi.fn();
    const result = (plugin as any).handleHotUpdate({
      file: path.join(webappDir, "Component.js"),
      server: { ws: { send } },
    });
    expect(send).toHaveBeenCalledWith({ type: "full-reload", path: "*" });
    expect(result).toEqual([]);
  });

  it("returns undefined for files outside webappDir", () => {
    const plugin = mainPlugin({ webappPath: webappDir });
    const send = vi.fn();
    const result = (plugin as any).handleHotUpdate({
      file: "/some/other/dir/file.js",
      server: { ws: { send } },
    });
    expect(send).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

describe("plugin — resolverPlugin.resolveId()", () => {
  it("resolves sap/ modules to virtual ESM prefix", () => {
    const plugin = resolverPlugin({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: webappDir,
    });
    expect((plugin as any).resolveId("sap/m/Button")).toBe(
      "\0vite-plugin-ui5:ui5-esm:sap/m/Button",
    );
  });

  it("returns null for unrecognized sources", () => {
    const plugin = resolverPlugin({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: webappDir,
    });
    expect((plugin as any).resolveId("lodash")).toBeNull();
  });
});
