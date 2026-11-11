import { build } from "esbuild";

await build({
  entryPoints: ["server/vercel.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "api/index.mjs",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);',
  },
  plugins: [
    {
      name: "stub-pg-native",
      setup(build) {
        build.onResolve({ filter: /^pg-native$/ }, () => ({
          path: "pg-native",
          namespace: "stub",
        }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export default {};",
          loader: "js",
        }));
      },
    },
  ],
  logLevel: "info",
});
