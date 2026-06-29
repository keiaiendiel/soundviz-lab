/* Assemble the single self-contained index.html from the template + parts + all demo files.
   Usage: node assemble.js <outfile> */
'use strict';
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const out = process.argv[2] || path.join(dir, 'index.html');

const tpl = fs.readFileSync(path.join(dir, 'index.template.html'), 'utf8');
const styles = fs.readFileSync(path.join(dir, 'styles.css'), 'utf8');
const labutil = fs.readFileSync(path.join(dir, 'labutil.js'), 'utf8');
const audio = fs.readFileSync(path.join(dir, 'audio.js'), 'utf8');
const app = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');

const demoDir = path.join(dir, 'demos');
const files = fs.readdirSync(demoDir).filter(f => f.endsWith('.js')).sort();
const demos = files.map(f => '/* ===== ' + f + ' ===== */\n' + fs.readFileSync(path.join(demoDir, f), 'utf8')).join('\n\n');

function inject(src, marker, payload) {
  const m = '/*__' + marker + '__*/';
  const i = src.indexOf(m);
  if (i < 0) throw new Error('marker not found: ' + marker);
  return src.slice(0, i) + payload + src.slice(i + m.length);
}

let html = tpl;
html = inject(html, 'STYLES', styles);
html = inject(html, 'LABUTIL', labutil);
html = inject(html, 'DEMOS', demos);
html = inject(html, 'AUDIO', audio);
html = inject(html, 'APP', app);

fs.writeFileSync(out, html);
console.log('Wrote ' + out + ' (' + (html.length / 1024).toFixed(0) + ' KB, ' + files.length + ' demos).');
