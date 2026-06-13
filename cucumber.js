const path = require('path');

// Resolve the conductor-e2e hooks file. We resolve the package main entry
// and derive the hooks path from it so that the hooks share the same
// @cucumber/cucumber instance as the runner — required for World hooks.
// This avoids relying on package subpath exports which may not be declared.
const conductorMain = require.resolve('conductor-e2e');
const conductorHooks = conductorMain.replace(/[\/]dist[\/]src[\/]index.js$/, path.sep + path.join('dist', 'src', 'hooks', 'index.js'));

const common = {
  requireModule: ['ts-node/register', 'tsconfig-paths/register'],
  // Load order matters: framework hooks first, then support/ (custom hooks,
  // setDefaultTimeout, etc. that register against Cucumber), then step defs.
  // Exclude .d.ts declaration files — ts-node cannot execute them.
  require: [conductorHooks, 'support/**/*.ts', '!support/**/*.d.ts', 'step-definitions/**/*.ts'],
  // 'summary' is essential for diagnosing failures — without it, a failing run
  // prints minimal output and exits non-zero with no clue what broke.
  // 'progress-bar' adds the visual progress indicator for slow runs.
  format: [
    'summary',
    'progress-bar',
    'allure-cucumberjs/reporter',
    'json:reports/cucumber-report.json',
  ],
  formatOptions: { snippetInterface: 'async-await' },
};

module.exports = {
  default: {
    ...common,
    paths: ['features/**/*.feature'],
  },

  api: {
    ...common,
    paths: ['features/api/**/*.feature'],
    tags: '@api',
  },
};
