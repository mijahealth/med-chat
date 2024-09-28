// eslint.config.mjs

import globals from 'globals';
import js from '@eslint/js';
import * as typescriptEslint from '@typescript-eslint/eslint-plugin';
import jsdocPluginModule from 'eslint-plugin-jsdoc';

// Handle CommonJS export for ESM
const jsdocPlugin = jsdocPluginModule.default || jsdocPluginModule;

// Manually define JSDoc recommended rules to avoid legacy config issues
const jsdocRules = {
  'jsdoc/check-alignment': 'error',
  'jsdoc/check-examples': 'off',
  'jsdoc/check-indentation': 'error',
  ...(jsdocPlugin.rules['newline-after-description'] && {
    'jsdoc/newline-after-description': 'error',
  }),
  'jsdoc/no-types': 'off',
  'jsdoc/require-description': 'error', // Changed to 'error'
  'jsdoc/require-param': 'error',
  'jsdoc/require-param-description': 'error',
  'jsdoc/require-param-type': 'off',
  'jsdoc/require-returns': 'error', // Changed to 'error'
  'jsdoc/require-returns-description': 'error', // Changed to 'error'
  'jsdoc/require-returns-type': 'off',
};

// Export the flat config array
export default [
  // 1. Ignore patterns (unchanged)
  {
    ignores: [
      'dist/**',
      'build/**',
      'public/dist/**',
      '**/bundle.js',
      '**/*.bundle.js',
      'webpack.config.js',
      'node_modules/**',
      'eslint.config.mjs',
    ],
  },

  // 2. Apply ESLint's recommended JavaScript rules (unchanged)
  js.configs.recommended,

  // 3. Apply JSDoc rules (unchanged)
  {
    plugins: {
      jsdoc: jsdocPlugin,
    },
    rules: jsdocRules,
  },

  // 4. Global configuration for all files except ignored ones
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'always'],
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      // Added rules for scalability and best practices
      'max-len': ['error', { code: 100, ignoreUrls: true }],
      'complexity': ['error', 10],
      'no-magic-numbers': ['warn', { ignore: [-1, 0, 1, 2] }],
      'prefer-destructuring': ['error', { array: true, object: true }],
      'no-param-reassign': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'prefer-arrow-callback': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
    },
  },

  // 7. TypeScript specific configuration
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: typescriptEslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/explicit-function-return-type': 'error', // Changed to 'error'
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'error', // Added
      '@typescript-eslint/no-unnecessary-condition': 'error', // Added
      '@typescript-eslint/no-floating-promises': 'error', // Added
      '@typescript-eslint/await-thenable': 'error', // Added
    },
  },

  // 8. Node.js specific configuration (unchanged)
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-process-exit': 'error',
      'no-path-concat': 'error',
      'no-new-require': 'error',
      'no-buffer-constructor': 'error',
      'no-mixed-requires': ['error', { grouping: true, allowCall: true }],
      'handle-callback-err': 'error',
      'no-sync': 'warn',
    },
  },

  // 9. Browser-specific configuration
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        axios: 'readonly',
        feather: 'readonly',
        Twilio: 'readonly',
      },
    },
    rules: {
      'no-alert': 'warn',
      'no-var': 'error', // Added to enforce let/const in browser code
      'prefer-const': 'error', // Added to prefer const in browser code
    },
  },
];