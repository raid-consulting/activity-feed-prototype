const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (!match) {
  throw new Error('Could not find inline script in index.html');
}

try {
  new vm.Script(match[1], { filename: 'index-inline-script.js' });
  console.log('index.html inline script compiles without syntax errors.');
} catch (err) {
  console.error('index.html inline script failed to compile:', err);
  process.exitCode = 1;
}
