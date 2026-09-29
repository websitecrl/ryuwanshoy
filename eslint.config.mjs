import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier/flat'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Flags mount-time localStorage reads and fetch-then-setState effects,
      // which this app uses deliberately to avoid hydration mismatches.
      // Kept visible as warnings rather than blocking lint.
      'react-hooks/set-state-in-effect': 'warn',
      // Apostrophes/quotes in JSX text render fine; this is style only.
      'react/no-unescaped-entities': 'warn',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // OpenNext / Wrangler build output
    '.open-next/**',
    '.wrangler/**',
    // Local Claude Code tooling (gitignored, not app code)
    '.claude/**',
  ]),
])

export default eslintConfig
