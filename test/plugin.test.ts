import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadUI5Config } from "../src/config.js";
import { createUI5Resolver } from "../src/resolver.js";
import ui5Plugin from "../src/index.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");

describe("vite-plugin-ui5", () => {
  it("should parse ui5.yaml and manifest.json correctly", () => {
    const config = loadUI5Config({
      root: fixtureDir,
      webappPath: "webapp",
    });

    expect(config.appNamespace).toBe("test.app");
    expect(config.projectConfig.framework?.name).toBe("SAPUI5");
    expect(config.projectConfig.framework?.version).toBe("1.136.0");
    expect(config.cdnBaseUrl).toBe("https://ui5.sap.com");
    expect(config.resourceRoots["test.app"]).toBe("/");
  });

  it("should resolve application namespace paths", () => {
    const webappDir = path.resolve(fixtureDir, "webapp");
    const resolver = createUI5Resolver({
      appNamespace: "test.app",
      webappDir,
    });

    const resolvedController = resolver.resolveId("test/app/controller/Main.controller");
    expect(resolvedController).toBe(path.resolve(webappDir, "controller/Main.controller.js"));

    const resolvedComponent = resolver.resolveId("test/app/Component");
    expect(resolvedComponent).toBe(path.resolve(webappDir, "Component.js"));
  });

  it("should resolve SAPUI5 framework modules to virtual resource paths", () => {
    const webappDir = path.resolve(fixtureDir, "webapp");
    const resolver = createUI5Resolver({
      appNamespace: "test.app",
      webappDir,
    });

    const resolvedButton = resolver.resolveId("sap/m/Button");
    expect(resolvedButton).toBe("/resources/sap/m/Button.js");

    const resolvedController = resolver.resolveId("sap/ui/core/mvc/Controller");
    expect(resolvedController).toBe("/resources/sap/ui/core/mvc/Controller.js");
  });

  it("should transform index HTML with escaped resource roots", () => {
    const plugins = ui5Plugin({
      root: fixtureDir,
      webappPath: "webapp",
      resourceRoots: {
        "my.custom": "/custom/path",
      },
    });

    const mainPlugin = Array.isArray(plugins) ? plugins[0] : plugins;
    const html = '<script id="sap-ui-bootstrap"></script>';
    const result = (mainPlugin as any).transformIndexHtml(html);

    expect(result).toContain("data-sap-ui-resourceroots=");
    expect(result).toContain("test.app");
    expect(result).toContain("my.custom");
  });

  it("should return plugin array from ui5 export", () => {
    const plugins = ui5Plugin({
      root: fixtureDir,
      webappPath: "webapp",
    });

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBe(2);
  });
});
