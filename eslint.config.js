import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'build/**',
      '.react-router/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'node_modules/**',
      'worker-configuration.d.ts',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['app/**/*.tsx'],
    ignores: ['app/components/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement[name.name='table']",
          message: 'Use the shadcn Table components instead of a raw <table>.',
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: 'Use the shadcn NativeSelect or Select instead of a raw <select>.',
        },
        {
          selector: "JSXOpeningElement[name.name='option']",
          message: 'Use the shadcn NativeSelectOption or SelectItem instead of a raw <option>.',
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            'Use the shadcn Input instead of a raw <input>. Add an inline disable with justification only for hidden or file inputs.',
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
