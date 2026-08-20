const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dockerignore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`${label} must contain ${needle}`);
  }
}

requireText(dockerignore, '.env\n', '.dockerignore');
requireText(dockerignore, '.env.*', '.dockerignore');
requireText(dockerignore, '!.env.example', '.dockerignore');
requireText(dockerignore, 'node_modules', '.dockerignore');
requireText(dockerignore, 'build', '.dockerignore');
requireText(dockerfile, 'RUN npm ci', 'Dockerfile');
requireText(dockerfile, 'COPY nginx.conf /etc/nginx/conf.d/default.conf', 'Dockerfile');

for (const key of ['REACT_APP_POS_LOCAL_API_TOKEN', 'REACT_APP_RESUME_PASSWORD']) {
  const match = envExample.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) {
    throw new Error(`.env.example must declare ${key}`);
  }
  if (match[1].trim() !== '') {
    throw new Error(`${key} must remain empty in the committed example`);
  }
}

if (/^REACT_APP_[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN)[ \t]*=[ \t]*[^\s#]+/m.test(envExample)) {
  throw new Error('Committed REACT_APP secret/token/password values are forbidden');
}

console.log('V1 frontend deployment context acceptance passed');
