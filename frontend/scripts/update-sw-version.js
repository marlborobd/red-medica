const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, '..', 'public', 'sw.js');
const version = Date.now();

let content = fs.readFileSync(swPath, 'utf8');
content = content.replace(
  /const CACHE_NAME = 'red-medica-[^']*'/,
  `const CACHE_NAME = 'red-medica-${version}'`
);
fs.writeFileSync(swPath, content);
console.log(`[SW] CACHE_NAME actualizat: red-medica-${version}`);
