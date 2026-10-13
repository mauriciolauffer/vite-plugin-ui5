import { describe, it, expect } from "vitest";
import path from "node:path";
import ui5Plugin from "../src/index.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");
const webappDir = path.resolve(fixtureDir, "webapp");

function mainPlugin(opts: Parameters<typeof ui5Plugin>[0] = {}) {
  const plugins = ui5Plugin(opts);
  return Array.isArray(plugins) ? plugins[0] : plugins;
}

describe("isESM babel transform", () => {
  it("does not transform files outside webappDir", async () => {
    const plugin = mainPlugin({ webappPath: webappDir, isESM: true });
    const result = await (plugin as any).transform(
      'import UIComponent from "sap/ui/core/UIComponent";',
      "/some/other/dir/Component.js",
    );
    expect(result).toBeNull();
  });

  it("does not transform when isESM=false", async () => {
    const plugin = mainPlugin({ webappPath: webappDir, isESM: false });
    const result = await (plugin as any).transform(
      "sap.ui.define([], function() {});",
      path.join(webappDir, "Component.js"),
    );
    expect(result).toBeNull();
  });

  it("transpiles ESM to AMD for app .js files when isESM=true", async () => {
    const plugin = mainPlugin({ webappPath: webappDir, isESM: true });
    const result = await (plugin as any).transform(
      'import UIComponent from "sap/ui/core/UIComponent";\nexport default UIComponent.extend("test.app.Component", {});',
      path.join(webappDir, "Component.js"),
    );
    expect(result).not.toBeNull();
    expect(result.code).toContain("sap.ui.define");
    expect(result.code).not.toContain("import ");
  });

  it("transpiles TypeScript ESM to AMD for app .ts files when isESM=true", async () => {
    const plugin = mainPlugin({ webappPath: webappDir, isESM: true });
    const result = await (plugin as any).transform(
      'import UIComponent from "sap/ui/core/UIComponent";\nexport default class Component extends UIComponent { public init(): void { super.init(); } }',
      path.join(webappDir, "Component.ts"),
    );
    expect(result).not.toBeNull();
    expect(result.code).toContain("sap.ui.define");
    expect(result.code).not.toContain("import ");
    expect(result.code).not.toContain(": void");
  });
});
