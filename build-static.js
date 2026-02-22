#!/usr/bin/env node
/**
 * Copy Vite build output (dist/) to server/static for serving the Chat UI from the Python backend.
 * Run after: npm run build
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'dist');
const dest = path.join(__dirname, 'server', 'static');

if (!fs.existsSync(src)) {
  console.error('Run "npm run build" first. Missing:', src);
  process.exit(1);
}

function copyDir(s, d) {
  fs.mkdirSync(d, { recursive: true });
  for (const name of fs.readdirSync(s)) {
    const srcPath = path.join(s, name);
    const destPath = path.join(d, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(dest)) {
  fs.rmSync(dest, { recursive: true });
}
copyDir(src, dest);
console.log('Copied dist/ to server/static');