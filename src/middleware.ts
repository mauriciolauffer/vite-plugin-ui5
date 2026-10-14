import type { ViteDevServer } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import fs from "node:fs/promises";
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
    server.middlewares.use((req, res, next) =>
      serveRequest(normalizedWebappDir, isESM, req, res, next),
    );
  };
}

async function serveRequest(
  normalizedWebappDir: string,
  isESM: boolean,
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
): Promise<void> {
  const url = req.url || "";
  const { pathname } = new URL(url, "http://localhost");

  if (pathname.startsWith("/resources/") || pathname.startsWith("/test-resources/")) {
    return next();
  }

  // Let Vite handle .html files so its transform pipeline (HMR injection etc.) runs.
  if (pathname.endsWith(".html") || pathname === "/") {
    return next();
  }

  const localPath = path.resolve(normalizedWebappDir, "." + path.normalize(pathname));
  const rel = path.relative(normalizedWebappDir, localPath);

  // When isESM is true, .js/.css are ESM source — let Vite's transform
  // pipeline handle them. Otherwise serve as static files (classic AMD).
  const isViteScript = isESM && (localPath.endsWith(".js") || localPath.endsWith(".css"));
  const isContained = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));

  if (!isContained || isViteScript) {
    return next();
  }

  let stat: Awaited<ReturnType<typeof fs.stat>> | null = null;
  try {
    stat = await fs.stat(localPath);
  } catch {
    return next();
  }

  if (!stat.isFile()) {
    return next();
  }

  const content = await fs.readFile(localPath);
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
}
