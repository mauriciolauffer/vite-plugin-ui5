import { defineConfig } from "vite";
import ui5 from "vite-plugin-ui5";

export default defineConfig({
  root: "webapp",
  devtools: true,
  plugins: [ui5()],
});
