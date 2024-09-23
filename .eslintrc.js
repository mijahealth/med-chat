// .eslintrc.js

module.exports = {
    env: {
      es2021: true, // Enable ES2021 globals
    },
    extends: [
      'eslint:recommended',
    ],
    parserOptions: {
      ecmaVersion: 12, // Allows for the parsing of modern ECMAScript features
      sourceType: 'module', // Allows for the use of imports
    },
    overrides: [
      // Server-side (Node.js) configuration
      {
        files: ['app.js', 'modules/**/*.js', 'routes/**/*.js', 'twilioClient.js'],
        env: {
          node: true,
          commonjs: true,
          es2021: true,
        },
        globals: {
          __dirname: 'readonly',
          process: 'readonly',
        },
        rules: {
          'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // Ignore unused vars that start with _
          'no-undef': 'error', // Ensure no undefined variables
        },
      },
      // Client-side (Browser) configuration
      {
        files: ['public/**/*.js'],
        env: {
          browser: true,
          es2021: true,
        },
        globals: {
          axios: 'readonly',
          feather: 'readonly',
          Twilio: 'readonly',
        },
        rules: {
          'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
          'no-undef': 'error',
        },
      },
    ],
    rules: {
      // General rules can be added here
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // Reiterate for global rules
      'no-undef': 'error', // Reiterate for global rules
    },
  };