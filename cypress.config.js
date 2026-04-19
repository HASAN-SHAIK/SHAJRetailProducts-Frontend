const { defineConfig } = require('cypress');
const fs = require('fs');
const path = require('path');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

const envFromFile = parseEnvFile(path.resolve(__dirname, '.env'));
const readEnv = (key, fallback) => process.env[key] || envFromFile[key] || fallback;

module.exports = defineConfig({
  e2e: {
    baseUrl: readEnv('CYPRESS_BASE_URL', 'http://localhost:3000'),
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    env: {
      email: readEnv('CYPRESS_EMAIL', ''),
      password: readEnv('CYPRESS_PASSWORD', ''),
      apiUrl: readEnv('CYPRESS_API_URL', 'http://localhost:5000/api'),
    },
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
