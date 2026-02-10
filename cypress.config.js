const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3000',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    env: {
      email: process.env.CYPRESS_EMAIL,
      password: process.env.CYPRESS_PASSWORD,
      apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:5000/api',
    },
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
