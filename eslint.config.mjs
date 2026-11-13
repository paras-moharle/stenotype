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
    "next-env.d.ts",
    // Prisma-generated client.
    "generated/**",
  ]),
  {
    rules: {
      // Advisories from the React Compiler ruleset. The typing engine and the
      // shadcn carousel intentionally reset state inside effects when props
      // change, so keep these visible without failing the build.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
