import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { loadUI5Config } from "../src/config.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");

describe("config.ts", () => {
  it("parses ui5.yaml and manifest.json correctly", () => {
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: path.resolve(fixtureDir, "webapp"),
    });

    expect(config.appNamespace).toBe("test.app");
    expect(config.projectConfig.framework?.name).toBe("SAPUI5");
    expect(config.projectConfig.framework?.version).toBe("1.136.0");
    expect(config.cdnBaseUrl).toBe("https://ui5.sap.com/1.136.0");
    expect(config.resourceRoots["test.app"]).toBe("/");
  });

  it("uses defaults when yaml does not exist", () => {
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(fixtureDir, "nonexistent.yaml"),
      webappPath: path.resolve(fixtureDir, "webapp"),
    });
    expect(config.appNamespace).toBe("test.app");
    expect(config.projectConfig).toEqual({});
    expect(config.isESM).toBe(false);
  });

  it("uses custom cdnUrl when provided", () => {
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(fixtureDir, "nonexistent.yaml"),
      webappPath: path.resolve(fixtureDir, "webapp"),
      cdnUrl: "https://sdk.openui5.org",
    });
    expect(config.cdnBaseUrl).toBe("https://sdk.openui5.org");
  });

  it("uses base CDN URL without version when no framework version in yaml", () => {
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(fixtureDir, "nonexistent.yaml"),
      webappPath: path.resolve(fixtureDir, "webapp"),
    });
    expect(config.cdnBaseUrl).toBe("https://ui5.sap.com");
  });

  it("merges custom resourceRoots", () => {
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: path.resolve(fixtureDir, "webapp"),
      resourceRoots: { "my.shared.lib": "/shared" },
    });
    expect(config.resourceRoots["my.shared.lib"]).toBe("/shared");
    expect(config.resourceRoots["test.app"]).toBe("/");
  });

  it("falls back to metadata.name when manifest has no sap.app.id", () => {
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(fixtureDir, "ui5.yaml"),
      webappPath: path.resolve(fixtureDir, "nonexistent-webapp"),
    });
    expect(config.appNamespace).toBe("test.app");
  });

  it("isESM defaults to false and can be set to true", () => {
    expect(loadUI5Config({ webappPath: path.resolve(fixtureDir, "webapp") }).isESM).toBe(false);
    expect(
      loadUI5Config({ webappPath: path.resolve(fixtureDir, "webapp"), isESM: true }).isESM,
    ).toBe(true);
  });

  it("warns and continues on malformed yaml", () => {
    const badFixtureDir = path.resolve(__dirname, "fixtures/bad-yaml");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(badFixtureDir, "ui5.yaml"),
      webappPath: path.resolve(badFixtureDir, "webapp"),
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(config.appNamespace).toBe("bad.app");
    expect(config.projectConfig).toEqual({});
    warnSpy.mockRestore();
  });

  it("warns and continues on malformed manifest.json", () => {
    const badFixtureDir = path.resolve(__dirname, "fixtures/bad-manifest");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = loadUI5Config({
      ui5YamlPath: path.resolve(badFixtureDir, "ui5.yaml"),
      webappPath: path.resolve(badFixtureDir, "webapp"),
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(config.appNamespace).toBe("bad.manifest.app");
    warnSpy.mockRestore();
  });
});
