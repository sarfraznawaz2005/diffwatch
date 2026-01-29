#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let binary = 'diffwatch';
if (platform() === 'win32') {
  binary += '.exe';
}

const appPath = join(__dirname, '..', 'dist', binary);

const child = spawn(appPath, process.argv.slice(2), {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('error', (err) => {
  console.error('Failed to start diffwatch:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});
