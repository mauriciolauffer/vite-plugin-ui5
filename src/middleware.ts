import type { ViteDevServer } from "vite";
import fs from "node:fs";
import path from "node:path";

/** Options for {@link createUI5Middleware}. */
export interface UI5MiddlewareOptions {
  webappDir: string;
  isESM: boolean;
}

/**
 * Creates a Vite dev-server middleware that serves static files from `webappDir`
 * for non-resource requests. `/resources/*` and `/test-resources/*` are not
 * handled here — configure a Vite proxy in your `vite.config.ts` to forward
 * those to the UI5 CDN of your choice.
 */
export function createUI5Middleware(options: UI5MiddlewareOptions) {
  const { webappDir, isESM } = options;
  const normalizedWebappDir = path.resolve(webappDir);

  return (server: ViteDevServer) => {
    server.middlewares.use((req, res, next) => {
      const url = req.url || "";
      const cleanUrl = url.split("?")[0];

      if (url.startsWith("/resources/") || url.startsWith("/test-resources/")) {
        return next();
      }

      const localPath = path.resolve(normalizedWebappDir, "." + path.normalize(cleanUrl));
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
    });
  };
}
