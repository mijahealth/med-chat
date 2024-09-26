import globals from "globals";
import js from "@eslint/js";

export default [
  // Node.js files
  {
    files: ["**/*.js"],
    ignores: ["public/**/*.js"], // Exclude browser files
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node, // Node.js globals
      },
    },
    rules: {
      // Your custom Node.js rules
    },
  },
  // Browser files
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module", // Assuming you use ES modules in your browser code
      globals: {
        ...globals.browser, // Browser globals
      },
    },
    rules: {
      // Your custom browser rules
    },
  },
  // Apply recommended rules
  js.configs.recommended,
];