import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { loadUI5Config } from "../src/config.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");

describe("config.ts", () => {
  it("reads appNamespace from manifest.json", () => {
    const config = loadUI5Config({
      webappPath: path.resolve(fixtureDir, "webapp"),
    });
    expect(config.appNamespace).toBe("test.app");
  });

  it("defaults appNamespace to 'my.app' when manifest has no sap.app.id", () => {
    const config = loadUI5Config({
      webappPath: path.resolve(fixtureDir, "nonexistent-webapp"),
    });
    expect(config.appNamespace).toBe("my.app");
  });

  it("isESM defaults to false and can be set to true", () => {
    expect(loadUI5Config({ webappPath: path.resolve(fixtureDir, "webapp") }).isESM).toBe(false);
    expect(
      loadUI5Config({ webappPath: path.resolve(fixtureDir, "webapp"), isESM: true }).isESM,
    ).toBe(true);
  });

  it("warns and continues on malformed manifest.json", () => {
    const badFixtureDir = path.resolve(__dirname, "fixtures/bad-manifest");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const config = loadUI5Config({
      webappPath: path.resolve(badFixtureDir, "webapp"),
    });
    expect(warnSpy).toHaveBeenCalled();
    expect(config.appNamespace).toBe("my.app");
    warnSpy.mockRestore();
  });
});
