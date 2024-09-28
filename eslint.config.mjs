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
  // Conditionally add 'newline-after-description' if available
  ...(jsdocPlugin.rules['newline-after-description'] && {
    'jsdoc/newline-after-description': 'error',
  }),
  'jsdoc/no-types': 'off',
  'jsdoc/require-description': 'off',
  'jsdoc/require-param': 'error',
  'jsdoc/require-param-description': 'error',
  'jsdoc/require-param-type': 'off',
  'jsdoc/require-returns': 'off',
  'jsdoc/require-returns-description': 'off',
  'jsdoc/require-returns-type': 'off',
  // Add more JSDoc rules as needed
};

// Export the flat config array
export default [
  // 1. Ignore patterns
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

  // 2. Apply ESLint's recommended JavaScript rules
  js.configs.recommended,

  // 3. Apply JSDoc rules
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
      '@typescript-eslint': typescriptEslint, // Correctly imported as a namespace
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      // Add more TypeScript rules as needed
    },
  },

  // 8. Node.js specific configuration
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
    },
  },
];