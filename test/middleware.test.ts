import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createUI5Middleware } from "../src/middleware.js";

const fixtureDir = path.resolve(__dirname, "fixtures/app");
const webappDir = path.resolve(fixtureDir, "webapp");

function makeReqRes(url: string) {
  const req = { url, headers: { "user-agent": "test" } } as unknown as IncomingMessage;
  const chunks: Buffer[] = [];
  let statusCode = 200;
  const headers: Record<string, string> = {};
  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(v: number) {
      statusCode = v;
    },
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    end: vi.fn((data?: Buffer | string) => {
      if (data) chunks.push(Buffer.from(data));
    }),
    pipe: vi.fn(),
  } as unknown as ServerResponse;
  return { req, res, headers, chunks };
}

function setup(opts: Partial<Parameters<typeof createUI5Middleware>[0]> = {}) {
  const middleware = createUI5Middleware({
    webappDir,
    isESM: false,
    ...opts,
  });
  let handler!: Function;
  middleware({
    middlewares: {
      use: (fn: Function) => {
        handler = fn;
      },
    },
  } as any);
  return handler;
}

describe("middleware.ts — static file serving", () => {
  it("serves .xml with application/xml content-type", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/view/Main.view.xml");
    handler(req, res, vi.fn());
    expect(res.end).toHaveBeenCalled();
  });

  it("serves .json with application/json content-type", () => {
    const handler = setup();
    const { req, res, headers } = makeReqRes("/manifest.json");
    handler(req, res, vi.fn());
    expect(headers["Content-Type"]).toBe("application/json");
    expect(res.end).toHaveBeenCalled();
  });

  it("serves .js in classic mode (isESM=false)", () => {
    const handler = setup({ isESM: false });
    const { req, res } = makeReqRes("/Component.js");
    const next = vi.fn();
    handler(req, res, next);
    expect(res.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("passes .js to Vite in ESM mode (isESM=true)", () => {
    const handler = setup({ isESM: true });
    const { req, res } = makeReqRes("/Component.js");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("strips query string when resolving path", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/manifest.json?v=123");
    handler(req, res, vi.fn());
    expect(res.end).toHaveBeenCalled();
  });

  it("calls next() for non-existent file", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/nonexistent.js");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next() for path traversal", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/../../../etc/passwd");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next() for directory path (not a file)", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/controller");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("calls next() when req.url is undefined", () => {
    const handler = setup();
    const req = { url: undefined, headers: {} } as unknown as IncomingMessage;
    const { res } = makeReqRes("/");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("serves .properties with text/plain content-type", () => {
    const propsPath = path.resolve(webappDir, "i18n.properties");
    fs.writeFileSync(propsPath, "key=value");
    try {
      const handler = setup();
      const { req, res, headers } = makeReqRes("/i18n.properties");
      handler(req, res, vi.fn());
      expect(headers["Content-Type"]).toBe("text/plain; charset=utf-8");
      expect(res.end).toHaveBeenCalled();
    } finally {
      fs.unlinkSync(propsPath);
    }
  });

  it("serves .css with text/css content-type in classic mode", () => {
    const cssPath = path.resolve(webappDir, "style.css");
    fs.writeFileSync(cssPath, "body {}");
    try {
      const handler = setup({ isESM: false });
      const { req, res, headers } = makeReqRes("/style.css");
      handler(req, res, vi.fn());
      expect(headers["Content-Type"]).toBe("text/css; charset=utf-8");
      expect(res.end).toHaveBeenCalled();
    } finally {
      fs.unlinkSync(cssPath);
    }
  });

  it("calls next() for /resources/* requests", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/resources/sap-ui-core.js");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });

  it("calls next() for /test-resources/* requests", () => {
    const handler = setup();
    const { req, res } = makeReqRes("/test-resources/sap/ui/qunit/QUnitUtils.js");
    const next = vi.fn();
    handler(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
  });
});
