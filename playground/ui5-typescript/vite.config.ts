import { defineConfig } from "vite";
import ui5 from "vite-plugin-ui5";

export default defineConfig({
  devtools: true,
  plugins: [ui5({ isESM: true })],
  server: {
    proxy: {
      '/resources': 'https://ui5.sap.com',
      '/test-resources': 'https://ui5.sap.com',
    },
  },
});
