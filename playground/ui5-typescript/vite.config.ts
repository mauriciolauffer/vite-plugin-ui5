import { defineConfig } from "vite";
import ui5 from "../../src/index.js";

export default defineConfig({
  devtools: true,
  plugins: [ui5()],
});
