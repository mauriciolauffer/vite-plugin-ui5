import { defineConfig } from "vite";
import ui5 from "../../src/index.js";

export default defineConfig({
  root: "webapp",
  devtools: true,
  plugins: [ui5()],
});
