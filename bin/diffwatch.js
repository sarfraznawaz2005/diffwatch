#!/usr/bin/env node

import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if bun is installed
let bunPath;
try {
  const result = execSync('where bun', { encoding: 'utf-8' }).trim();
  bunPath = result.split('\n')[0]; // Take first result
} catch (error) {
  // Check if bun is in common locations on Windows
  if (process.platform === 'win32') {
    const possiblePaths = [
      join(process.env.LOCALAPPDATA, 'Bun', 'bun.exe'),
      join(process.env.ProgramFiles, 'bun', 'bun.exe'),
    ];
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        bunPath = p;
        break;
      }
    }
  }
}

if (!bunPath) {
  console.error('Error: Bun is not installed.');
  console.error('');
  console.error('DiffWatch requires Bun to run. Please install Bun:');
  console.error('');
  console.error('  curl -fsSL https://bun.sh/install | bash');
  console.error('');
  console.error('Or visit: https://bun.sh');
  process.exit(1);
}

const srcPath = join(__dirname, '..', 'src', 'index.tsx');

const child = spawn(bunPath, ['run', srcPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true, // Required for Windows
  cwd: process.cwd()
});

child.on('error', (err) => {
  console.error('Failed to start diffwatch:', err.message);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
