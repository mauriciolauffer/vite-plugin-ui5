import type { ViteDevServer } from "vite";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";

export interface UI5MiddlewareOptions {
  cdnBaseUrl: string;
  webappDir: string;
}

export function createUI5Middleware(options: UI5MiddlewareOptions) {
  const { cdnBaseUrl, webappDir } = options;
  const normalizedWebappDir = path.resolve(webappDir);

  return (server: ViteDevServer) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const cleanUrl = url.split("?")[0];

      // 1. Check if the request is for local webapp static files
      if (!url.startsWith("/resources/") && !url.startsWith("/test-resources/")) {
        // Safe path resolution preventing Path Traversal
        const safeRelativePath = path.normalize(cleanUrl).replace(/^(\.\.[/\\])+/, "");
        const localPath = path.resolve(
          normalizedWebappDir,
          "." + (safeRelativePath.startsWith("/") ? safeRelativePath : "/" + safeRelativePath),
        );

        // Enforce path containment within normalizedWebappDir using path.relative
        const rel = path.relative(normalizedWebappDir, localPath);
        const isContained = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));

        const isViteModule = localPath.endsWith(".js") || localPath.endsWith(".css");

        if (
          isContained &&
          !isViteModule &&
          fs.existsSync(localPath) &&
          fs.statSync(localPath).isFile()
        ) {
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
      const targetUrl = `${cdnBaseUrl.replace(/\/$/, "")}${url}`;
      const isHttps = targetUrl.startsWith("https");
      const client = isHttps ? https : http;

      // Request identity encoding to receive uncompressed text for modification
      const requestOptions = {
        headers: {
          "user-agent": req.headers["user-agent"] || "vite-plugin-ui5",
          "accept-encoding": "identity",
        },
      };

      client
        .get(targetUrl, requestOptions, (proxyRes) => {
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
            res.statusCode = 404;
            res.end(`[vite-plugin-ui5] Resource not found on CDN: ${targetUrl}`);
          } else {
            res.statusCode = proxyRes.statusCode || 500;
            res.end(`[vite-plugin-ui5] CDN request failed with status: ${proxyRes.statusCode}`);
          }
        })
        .on("error", (err) => {
          res.statusCode = 500;
          res.end(`[vite-plugin-ui5] Error proxying request to CDN: ${err.message}`);
        });
    });
  };
}
