import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "dist-static/**",
    "next-env.d.ts",
  ]),
  {
    files: ["src/**/*.{js,jsx}"],
    rules: {
      // This client-first app intentionally restores browser state in effects.
      "react-hooks/set-state-in-effect": "off",
      // PokéAPI artwork URLs are dynamic and cannot use the Next image optimizer.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
