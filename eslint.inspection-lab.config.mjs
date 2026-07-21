import { defineConfig, globalIgnores } from "eslint/config";
import eslintConfig from "./eslint.config.mjs";

const inspectionLabConfig = defineConfig([
  ...eslintConfig,
  globalIgnores([
    "inspection-lab/e2e-runs/**",
    "inspection-lab/test-results/**",
    "inspection-lab/mobile-app/.expo/**",
    "inspection-lab/mobile-app/.cache/**",
    "inspection-lab/mobile-app/node_modules/**",
  ]),
  {
    files: ["inspection-lab/mobile-app/**/*.{js,jsx}"],
    rules: {
      // React Native Image uses `source`, not the web-specific `alt` contract.
      "jsx-a11y/alt-text": "off",
      // Apostrophes and quotes are valid text content inside React Native Text.
      "react/no-unescaped-entities": "off",
    },
  },
]);

export default inspectionLabConfig;
