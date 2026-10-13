# vite-plugin-ui5

> Vite plugin for SAPUI5 and OpenUI5 applications.

## Installation

```bash
npm install vite-plugin-ui5
```

## Configuration

Add the plugin to your `vite.config.js`:

```js
import { defineConfig } from "vite";
import ui5 from "vite-plugin-ui5";

export default defineConfig({
  plugins: [ui5()],
});
```

By default, the plugin reads `ui5.yaml` from the project root and `manifest.json` from `webapp/`. It uses the application ID from the manifest as the UI5 namespace and serves SAPUI5/OpenUI5 resources from `https://ui5.sap.com`.

### Options

```ts
ui5({
  // Path to ui5.yaml relative to cwd.
  // Default: 'ui5.yaml'
  ui5YamlPath: "ui5.yaml",

  // Path to webapp directory relative to cwd.
  // Default: value from ui5.yaml resources.configuration.paths.webapp or 'webapp'
  webappPath: "webapp",

  // CDN base URL for UI5 framework resources.
  // Default: https://ui5.sap.com
  cdnUrl: "https://sdk.openui5.org",

  // Additional resource root mappings injected into sap-ui-bootstrap.
  resourceRoots: { "my.shared.lib": "/shared" },

  // Custom module path aliases.
  aliases: { "@shared": "./src/shared" },

  // Set to true when the app uses ESM syntax (import/export) or TypeScript.
  // The plugin transpiles app files to AMD at serve time
  // using babel-plugin-transform-modules-ui5 so the UI5 loader can handle them.
  // Default: false (classic UI5/AMD -> sap.ui.define)
  isESM: false,
});
```

---

## Writing UI5 apps

### Classic AMD (default)

Regular UI5 apps using `sap.ui.define` work out of the box with no extra configuration:

```js
// Component.js
sap.ui.define(["sap/ui/core/UIComponent"], function (UIComponent) {
  return UIComponent.extend("my.app.Component", {
    metadata: { manifest: "json" },
  });
});
```

### ESM (`isESM: true`)

With `isESM: true`, app files can be written using standard ESM syntax. The plugin transpiles them to AMD at serve time using `babel-plugin-transform-modules-ui5`:

```js
// Component.js
import UIComponent from "sap/ui/core/UIComponent";

export default UIComponent.extend("my.app.Component", {
  metadata: { manifest: "json" },
});
```

### TypeScript (`isESM: true`)

TypeScript files are also supported when `isESM: true`. Type annotations and ES class syntax are stripped and transpiled to AMD:

```ts
// Component.ts
import UIComponent from "sap/ui/core/UIComponent";

export default class Component extends UIComponent {
  public static metadata = { manifest: "json" };
}
```

---

## How it works

### Module resolution

The plugin resolves three categories of imports:

| Import                       | Resolved to                                     |
| :--------------------------- | :---------------------------------------------- |
| `sap/m/Button`               | AMD wrapper: `sap.ui.require(["sap/m/Button"])` |
| `my/app/controller/Main`     | File in `webappDir`                             |
| Custom alias (`@shared/...`) | Configured alias path                           |

### Framework resources

Requests to `/resources/*` and `/test-resources/*` are proxied to the configured CDN (default: `https://ui5.sap.com`). All other webapp files are served statically, except `.js`/`.ts` files when `isESM: true` which pass through Vite's transform pipeline.

### HMR

Any file change inside `webappDir` triggers a full page reload. UI5's AMD loader does not support partial module re-evaluation, so granular HMR is not possible.

---

## Playground

| App            | Directory                    | Script                | Description                                     |
| :------------- | :--------------------------- | :-------------------- | :---------------------------------------------- |
| UI5 App        | `playground/ui5-app/`        | `npm run dev:ui5`     | Classic AMD app                                 |
| UI5 ESM App    | `playground/ui5-app-esm/`    | `npm run dev:ui5:esm` | ESM app, transpiled to AMD by the plugin        |
| UI5 TypeScript | `playground/ui5-typescript/` | `npm run dev:ui5:ts`  | TypeScript app, transpiled to AMD by the plugin |

---

## Integration with UI5 CLI

`vite-plugin-ui5` is a development tool only. Production builds should continue to use `@ui5/cli`:

| Task   | Development                         | Production            |
| :----- | :---------------------------------- | :-------------------- |
| Serve  | `vite-plugin-ui5` + Vite dev server | `ui5 serve`           |
| Build  | —                                   | `ui5 build`           |
| Deploy | —                                   | `@sap/ux-ui5-tooling` |
