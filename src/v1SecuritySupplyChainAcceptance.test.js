const fs = require('fs');
const path = require('path');

describe('V1 Frontend supply-chain boundary', () => {
  test('production container build uses the committed lockfile deterministically', () => {
    const dockerfile = fs.readFileSync(path.join(__dirname, '../Dockerfile'), 'utf8');
    expect(dockerfile).toContain('FROM node:24 AS build');
    expect(dockerfile).toContain('COPY package*.json ./');
    expect(dockerfile).toContain('RUN npm ci');
    expect(dockerfile).not.toContain('RUN npm install');
  });

  test('package-lock is committed for npm ci', () => {
    const lockfile = JSON.parse(fs.readFileSync(path.join(__dirname, '../package-lock.json'), 'utf8'));
    expect(lockfile.lockfileVersion).toBeGreaterThanOrEqual(2);
    expect(lockfile.packages?.['']).toBeTruthy();
  });

  test('production dependency specs do not float on latest', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const floatingLatest = Object.entries(manifest.dependencies || {})
      .filter(([, spec]) => String(spec).trim().toLowerCase() === 'latest');
    expect(floatingLatest).toEqual([]);
  });

  test('jsonwebtoken manifest and lockfile stay pinned to the certified resolution', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
    const lockfile = JSON.parse(fs.readFileSync(path.join(__dirname, '../package-lock.json'), 'utf8'));

    expect(manifest.dependencies?.jsonwebtoken).toBe('9.0.2');
    expect(lockfile.packages?.['']?.dependencies?.jsonwebtoken).toBe('9.0.2');
    expect(lockfile.packages?.['node_modules/jsonwebtoken']?.version).toBe('9.0.2');
  });
});
