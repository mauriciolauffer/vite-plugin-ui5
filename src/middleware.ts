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
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || "";
      const cleanUrl = url.split("?")[0];

      // 1. Check if the request is for local webapp static files
      if (!url.startsWith("/resources/") && !url.startsWith("/test-resources/")) {
        // Safe path resolution preventing Path Traversal
        const safeRelativePath = path.normalize(cleanUrl).replace(/^(\.\.[\/\\])+/, "");
        const localPath = path.resolve(normalizedWebappDir, "." + (safeRelativePath.startsWith("/") ? safeRelativePath : "/" + safeRelativePath));

        // Enforce path containment within normalizedWebappDir
        if (localPath.startsWith(normalizedWebappDir) && fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
          const content = fs.readFileSync(localPath);
          if (localPath.endsWith(".json")) {
            res.setHeader("Content-Type", "application/json");
          } else if (localPath.endsWith(".xml")) {
            res.setHeader("Content-Type", "application/xml");
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

      const client = targetUrl.startsWith("https") ? https : http;

      client
        .get(targetUrl, (proxyRes) => {
          if (proxyRes.statusCode && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
            let body = "";
            res.writeHead(proxyRes.statusCode, proxyRes.headers);

            // If JS module, transform AMD module code to ESM compatible export
            const isJsModule = url.endsWith(".js") || proxyRes.headers["content-type"]?.includes("javascript");
            if (isJsModule) {
              const chunks: Buffer[] = [];
              proxyRes.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
              proxyRes.on("end", () => {
                let code = Buffer.concat(chunks).toString("utf-8");
                const moduleName = url.replace(/^\/resources\//, "").replace(/\.js$/, "");
                // Append ESM default export shim referencing sap.ui.require
                code += `\n/* vite-plugin-ui5 ESM shim */\nif (typeof sap !== 'undefined' && sap.ui && sap.ui.require) {\n  export default sap.ui.require('${moduleName}');\n}\n`;
                res.end(code);
              });
            } else {
              proxyRes.pipe(res);
            }
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
