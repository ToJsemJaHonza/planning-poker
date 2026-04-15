import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // The React Compiler-aware rules below ship with the latest
      // eslint-plugin-react-hooks "recommended" preset. They flag patterns
      // (setState in effects, refs touched during render, manual memo
      // arrays) that the codebase uses intentionally — they are informative
      // hints, not bugs. Off so the lint job stays a real gate for
      // actionable mistakes rather than a wall of compiler hints.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // We co-locate small helper constants/functions next to their owning
      // component (e.g. `dbbSprites.jsx` exports both sprite components and
      // the size constants that describe them). Splitting every helper into
      // its own file would balloon the tree for no real HMR benefit at this
      // codebase size.
      'react-refresh/only-export-components': 'off',
    },
  },
  // Vite config + any other root-level build tooling runs in Node, not the
  // browser — give those globals so `process.env` and friends resolve.
  {
    files: ['vite.config.{js,ts}', '*.config.{js,ts}'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Vitest test files get vi/describe/it/beforeEach/afterEach/expect as
  // globals, matching how the rest of the suite imports them.
  {
    files: ['**/*.test.{js,jsx}', 'src/test/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.node,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
])
