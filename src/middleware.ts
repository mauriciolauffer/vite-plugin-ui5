import type { ViteDevServer } from "vite";
import type { IncomingMessage } from "node:http";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

/** Options for {@link createUI5Middleware}. */
export interface UI5MiddlewareOptions {
  cdnBaseUrl: string;
  webappDir: string;
  isESM: boolean;
}

function fetchWithRedirects(
  url: string,
  requestOptions: { headers: Record<string, string> },
  callback: (res: IncomingMessage) => void,
  onError: (err: Error) => void,
  redirectsLeft = 5,
): void {
  const client = url.startsWith("https") ? https : http;
  client
    .get(url, requestOptions, (res) => {
      const { statusCode, headers } = res;
      if (
        statusCode &&
        statusCode >= 300 &&
        statusCode < 400 &&
        headers.location &&
        redirectsLeft > 0
      ) {
        res.resume();
        const next = headers.location.startsWith("http")
          ? headers.location
          : new URL(headers.location, url).href;
        fetchWithRedirects(next, requestOptions, callback, onError, redirectsLeft - 1);
        return;
      }
      callback(res);
    })
    .on("error", onError);
}

/**
 * Creates a Vite dev-server middleware that:
 * 1. Serves static files from `webappDir` directly for non-resource requests.
 * 2. Proxies `/resources/*` and `/test-resources/*` requests to the UI5 CDN
 *    at `cdnBaseUrl`, following redirects, enabling transparent framework
 *    resource loading without a local `@ui5/cli` setup.
 */
export function createUI5Middleware(options: UI5MiddlewareOptions) {
  const { cdnBaseUrl, webappDir, isESM } = options;
  const normalizedWebappDir = path.resolve(webappDir);
  const normalizedCdnBaseUrl = cdnBaseUrl.replace(/\/$/, "");

  return (server: ViteDevServer) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const cleanUrl = url.split("?")[0];

      // 1. Check if the request is for local webapp static files
      if (!url.startsWith("/resources/") && !url.startsWith("/test-resources/")) {
        const localPath = path.resolve(normalizedWebappDir, "." + path.normalize(cleanUrl));

        // Enforce path containment within normalizedWebappDir using path.relative
        const rel = path.relative(normalizedWebappDir, localPath);

        // When isESM is true, .js/.css are ESM source — let Vite's transform
        // pipeline handle them. Otherwise serve as static files (classic AMD).
        const isViteScript = isESM && (localPath.endsWith(".js") || localPath.endsWith(".css"));
        const isContained = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));

        let stat: ReturnType<typeof fs.statSync> | null = null;
        if (isContained && !isViteScript) {
          try {
            stat = fs.statSync(localPath);
          } catch {
            // file does not exist — fall through to next()
          }
        }

        if (stat?.isFile()) {
          const content = fs.readFileSync(localPath);
          if (localPath.endsWith(".json")) {
            res.setHeader("Content-Type", "application/json");
          } else if (localPath.endsWith(".js")) {
            res.setHeader("Content-Type", "application/javascript; charset=utf-8");
          } else if (localPath.endsWith(".xml")) {
            res.setHeader("Content-Type", "application/xml");
          } else if (localPath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          } else if (localPath.endsWith(".properties")) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
          }
          res.end(content);
          return;
        }
        return next();
      }

      // 2. Fetch framework resources (/resources/* or /test-resources/*) from CDN
      const targetUrl = `${normalizedCdnBaseUrl}${url}`;

      const requestOptions = {
        headers: {
          "user-agent": req.headers["user-agent"] || "vite-plugin-ui5",
          "accept-encoding": "identity",
        },
      };

      fetchWithRedirects(
        targetUrl,
        requestOptions,
        (proxyRes) => {
          if (proxyRes.statusCode && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
            const headers = { ...proxyRes.headers };
            delete headers["content-length"];
            delete headers["content-encoding"];

            // UI5 resources are classic scripts loaded by the UI5 loader. They must
            // remain unmodified: adding ESM syntax (such as `export`) makes the
            // bootstrap script invalid when loaded through a normal script tag.
            res.writeHead(proxyRes.statusCode, headers);
            proxyRes.pipe(res);
          } else if (proxyRes.statusCode === 404) {
            proxyRes.resume();
            res.statusCode = 404;
            res.end(`[vite-plugin-ui5] Resource not found on CDN: ${targetUrl}`);
          } else {
            proxyRes.resume();
            res.statusCode = proxyRes.statusCode || 500;
            res.end(`[vite-plugin-ui5] CDN request failed with status: ${proxyRes.statusCode}`);
          }
        },
        (err) => {
          res.statusCode = 500;
          res.end(`[vite-plugin-ui5] Error proxying request to CDN: ${err.message}`);
        },
      );
    });
  };
}
