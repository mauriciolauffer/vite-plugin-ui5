import { describe, it, expect } from "vitest";
import path from "node:path";
import { createUI5Resolver } from "../src/resolver.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");
const webappDir = path.resolve(fixtureDir, "webapp");

describe("resolver.ts", () => {
  it("resolves app namespace paths", () => {
    const resolver = createUI5Resolver({ appNamespace: "test.app", webappDir });

    expect(resolver.resolveId("test/app/controller/Main.controller")).toBe(
      path.resolve(webappDir, "controller/Main.controller.js"),
    );
    expect(resolver.resolveId("test/app/Component")).toBe(path.resolve(webappDir, "Component.js"));
  });

  it("resolves sap/ framework modules to virtual ESM prefix", () => {
    const resolver = createUI5Resolver({ appNamespace: "test.app", webappDir });

    expect(resolver.resolveId("sap/m/Button")).toBe("\0vite-plugin-ui5:ui5-esm:sap/m/Button");
    expect(resolver.resolveId("sap/ui/core/mvc/Controller")).toBe(
      "\0vite-plugin-ui5:ui5-esm:sap/ui/core/mvc/Controller",
    );
  });

  it("strips .js extension from sap/ module IDs", () => {
    const resolver = createUI5Resolver({ appNamespace: "test.app", webappDir });
    expect(resolver.resolveId("sap/m/Button.js")).toBe("\0vite-plugin-ui5:ui5-esm:sap/m/Button");
  });

  it("returns null for unrecognized imports", () => {
    const resolver = createUI5Resolver({ appNamespace: "test.app", webappDir });
    expect(resolver.resolveId("lodash")).toBeNull();
    expect(resolver.resolveId("./relative/path")).toBeNull();
  });

  it("returns null for app namespace path when file does not exist", () => {
    const resolver = createUI5Resolver({ appNamespace: "test.app", webappDir });
    expect(resolver.resolveId("test/app/nonexistent/File")).toBeNull();
  });

  it("resolves custom alias to file", () => {
    const resolver = createUI5Resolver({
      appNamespace: "test.app",
      webappDir,
      aliases: { "@ctrl": "controller" },
    });
    expect(resolver.resolveId("@ctrl/Main.controller.js")).toBe(
      path.resolve(webappDir, "controller", "Main.controller.js"),
    );
  });

  it("falls through alias when resolved file does not exist", () => {
    const resolver = createUI5Resolver({
      appNamespace: "test.app",
      webappDir,
      aliases: { "@ctrl": "controller" },
    });
    expect(resolver.resolveId("@ctrl/Nonexistent")).toBeNull();
  });
});
