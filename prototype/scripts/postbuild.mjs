// بعد البناء: dist/index.html ملف واحد مكتمل (للجهاز)، وdist/artifact.html بلا هيكل (لنشر Artifact)
import fs from 'node:fs';
import path from 'node:path';
const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const body = html.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
// نحتفظ بالعنوان والخطوط والأنماط والسكربت فقط (بلا meta؛ هيكل النشر يضيفها)
const keep = head
  .replace(/<meta[^>]*>/gi, '')
  .trim();
fs.writeFileSync(path.join(dist, 'artifact.html'), `${keep}\n${body.trim()}\n`);
const kb = (f) => Math.round(fs.statSync(path.join(dist, f)).size / 1024);
console.log('postbuild ok', { 'index.html': kb('index.html') + ' KB', 'artifact.html': kb('artifact.html') + ' KB' });
