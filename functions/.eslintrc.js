module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  rules: {
    "no-unused-vars": "warn",
    "no-console": "off"
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "script",
  },
};
