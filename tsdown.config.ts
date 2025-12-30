import { defineConfig } from "tsdown";

export default defineConfig (
  {
    entry: 'psse.ts',
    outDir: 'dist',
    minify: true,
    sourcemap: true,
    exports: true,
  }
)
