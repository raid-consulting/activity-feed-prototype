const fs = require('fs');
const path = require('path');
const vm = require('vm');

function verifyInlineScript(fileName) {
  const htmlPath = path.join(__dirname, '..', fileName);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error(`Could not find inline script in ${fileName}`);
  }
  try {
    new vm.Script(match[1], { filename: `${fileName}-inline-script.js` });
    console.log(`${fileName} inline script compiles without syntax errors.`);
  } catch (err) {
    console.error(`${fileName} inline script failed to compile:`, err);
    process.exitCode = 1;
  }
}

['index.html', 'ai-review.html', 'admin.html'].forEach(verifyInlineScript);
