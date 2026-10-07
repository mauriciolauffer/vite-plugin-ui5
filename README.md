# vite-plugin-ui5

> Modern Vite development server and tooling platform for SAPUI5 and OpenUI5 applications.

---

## 💡 Overview & Architectural Concept

`vite-plugin-ui5` bridges the high-performance modern web development experience of **Vite** with **SAPUI5 / OpenUI5**.

Rather than attempting to replace `@ui5/cli` for production builds and deployment, `vite-plugin-ui5` focuses on providing an elite development experience (DX)—delivering lightning-fast cold starts, sub-millisecond Hot Module Replacement (HMR), first-class TypeScript support, and zero-config project discovery from `ui5.yaml` and `manifest.json`.

```
                    ┌─────────────────────┐
                    │      SAPUI5 App     │
                    │                     │
                    │  webapp/            │
                    │  manifest.json      │
                    │  Component.js       │
                    │  controller/        │
                    │  i18n/              │
                    └──────────┬──────────┘
                               │
                     ┌─────────▼─────────┐
                     │   Vite + UI5      │
                     │      Plugin       │
                     ├───────────────────┤
                     │ UI5 resolution    │
                     │ UI5 resources     │
                     │ ui5.yaml          │
                     │ middleware        │
                     │ aliases           │
                     │ preload support   │
                     │ debug tooling     │
                     └───────┬───────────┘
                             │
               ┌─────────────┴─────────────┐
               │                           │
        Vite development             UI5 production
        server / HMR                 build / deploy
               │                           │
               ▼                           ▼
        Fast HMR / DX                  @ui5/cli
```

---

## 🚀 Key Features

### 1. Vite-Powered UI5 Development

Integrates directly into Vite plugin lifecycle hooks (`resolveId`, `load`, `transform`, `configureServer`, and `transformIndexHtml`) to provide seamless serving of UI5 modules and assets.

```bash
$ npm run dev

  VITE v5.x.x  ready in 180 ms

  ➜  Local:   http://localhost:5173/

  UI5 Integration
  ✓ Framework: SAPUI5 v1.136.0
  ✓ Project:   my.app
  ✓ Component: my.app.Component
  ✓ ui5.yaml:  Loaded
  ✓ Modules:   142 UI5 modules mapped
```

### 2. Native UI5 Module Resolution

Translates standard ES import paths and UI5 module syntax smoothly:

```javascript
import Controller from "sap/ui/core/mvc/Controller";
import JSONModel from "sap/ui/model/json/JSONModel";
import Button from "sap/m/Button";
```

Maps UI5 framework paths (`sap/m/Button` → `/resources/sap/m/Button.js`) while maintaining standard resolution for local application modules (`my/app/controller/Main.controller.js`).

### 3. Direct `ui5.yaml` Compatibility

Eliminates configuration duplication by reading directly from `ui5.yaml`. The plugin automatically derives:

- UI5 Framework name and version (`SAPUI5` vs `OpenUI5`)
- Declared UI5 libraries (`sap.m`, `sap.ui.core`, `sap.ui.layout`)
- Resource roots and application namespaces
- Middleware configurations and custom shims

### 4. UI5 Framework Resource Management

Supports serving UI5 resources from multiple backends:

- Local `@ui5/cli` cache / local SDK
- SAP UI5 CDN (`ui5.sap.com` or `openui5.hana.ondemand.com`)
- `node_modules` npm-installed UI5 packages

### 5. UI5-Aware Hot Module Replacement (HMR)

Preserves application state, active routing, and model data across code updates:

```
┌──────────────────────────┐
│ UI5 Application State    │
│  Component               │
│    ├── Router (preserved)│
│    ├── Models (preserved)│
│    └── Views             │
│       ▲                  │
│       │ Hot Update       │
│ Controller / View edit   │
└──────────────────────────┘
```

Supports granular updates for:

- Controllers & Helpers
- XML Views & Fragments
- i18n properties
- CSS / LESS / SASS stylesheets
- JSON models & mock data

### 6. XML View & Fragment Transformation

Transforms UI5 XML views and fragments on-the-fly, giving immediate feedback during UI development without full browser reloads.

### 7. First-Class TypeScript Support

Enables modern TypeScript usage out of the box (`.ts` controllers, typed models, auto-generated UI5 type definitions) without requiring complex custom build pipelines.

### 8. `manifest.json` Awareness & Custom Path Aliases

Automatically detects application namespace (`sap.app.id`) and configures path aliases such as `@app` or `@test`.

---

## 🎯 Benefits

- **⚡ Blazing Fast DX:** Instant server startup and immediate module updates during development.
- **🔄 State-Preserving HMR:** No need to re-navigate or re-enter form data after editing controllers or views.
- **🛠️ Zero Duplicate Config:** Reuses existing `ui5.yaml` and `manifest.json` files without breaking existing UI5 CLI setups.
- **📦 Modern Tooling Ecosystem:** Unlocks the full Vite ecosystem (ESLint, Prettier, Tailwind CSS, Vitest, Cypress, Playwright).
- **🛡️ Risk-Free Adoption:** Developers get modern speed during development while relying on `@ui5/cli` for safe, standard production builds (`dist/`, `Component-preload.js`).

---

## 🔗 Integration with UI5 CLI

The integration model follows a clean separation of concerns:

| Task                   | Development Engine (`vite-plugin-ui5`) | Production Engine (`@ui5/cli`)                     |
| :--------------------- | :------------------------------------- | :------------------------------------------------- |
| **Server**             | Vite Dev Server (Fast, HMR)            | UI5 CLI Server (`ui5 serve`)                       |
| **Module Loading**     | Dynamic Vite ESM transformation        | Static / Preload bundling                          |
| **Building**           | Development bundling & preview         | Standard UI5 Build (`ui5 build`)                   |
| **Preload Generation** | Dev mock / optional                    | `Component-preload.js` generation                  |
| **Deployment**         | N/A                                    | Fiori / SAP BTP Deployment (`@sap/ux-ui5-tooling`) |

### Deep Tooling Integration

Under the hood, `vite-plugin-ui5` bridges UI5 CLI core tooling libraries:

- Uses `@ui5/project` for reading and resolving `ui5.yaml` dependency trees.
- Leverages `@ui5/fs` for virtual resource management.
- Adapts UI5 custom middleware (`customMiddleware`) into Vite's Connect middleware stack.

---

## 🗺️ Suggested Roadmap

- **V1 — UI5 Development Adapter**
  - `ui5.yaml` and `manifest.json` parsing
  - Framework loading (CDN / local cache)
  - UI5 module resolution & XML view support
  - Vite dev server & basic HMR
- **V2 — Advanced Developer Experience**
  - Granular UI5 state-preserving HMR for controllers and views
  - TypeScript integration with automatic type mapping
  - UI5 custom middleware bridge for existing `ui5.yaml` plugins
- **V3 — Testing & Quality Tools**
  - Integration with Vitest for UI5 unit and integration tests
  - Mock server & OData proxy integration
- **V4 — Shared UI5 Tooling Core**
  - Full bidirectional integration with `@ui5/builder` and SAP Fiori deployment tools.
