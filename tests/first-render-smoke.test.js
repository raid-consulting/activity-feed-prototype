const fs = require('fs');
const path = require('path');
const vm = require('vm');

function verifyInlineScript(fileName) {
  const htmlPath = path.join(__dirname, '..', fileName);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  let fileFailed = false;
  while ((match = pattern.exec(html))) {
    const attrs = match[1] || '';
    if (/\bsrc\s*=/.test(attrs)) {
      continue;
    }
    count += 1;
    const scriptContent = match[2];
    try {
      new vm.Script(scriptContent, { filename: `${fileName}-inline-script-${count}.js` });
    } catch (err) {
      console.error(`${fileName} inline script #${count} failed to compile:`, err);
      process.exitCode = 1;
      fileFailed = true;
    }
  }
  if (count === 0) {
    console.log(`${fileName} has no inline scripts to verify.`);
  } else if (!fileFailed) {
    console.log(`${fileName} inline scripts (${count}) compile without syntax errors.`);
  }
}

['index.html', 'ai-review.html', 'admin.html'].forEach(verifyInlineScript);
