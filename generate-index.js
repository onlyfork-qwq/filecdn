/* File Index Generator
   生成器：扫描当前目录，把真实文件列表写回 index.html 的 FILES 数组。
   用法：双击「生成索引.cmd」，或命令行运行 node generate-index.js
   流程：放好文件 -> 运行本生成器 -> 部署整个文件夹到云端静态托管。 */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const htmlFile = path.join(root, 'index.html');
const mb = 1048576;

function toDate(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const out = [];
/* 排除索引自身、本地辅助文件与隐藏文件（.vercel、.git 等）；img 为图床图片，不进列表 */
const skip = new Set(['index.html', 'server.js', 'generate-index.js', '启动索引服务.cmd', '生成索引.cmd', 'vercel.json']);
const skipDirs = new Set(['.git', 'node_modules', 'api', 'img']);
function walk(dir, relBase){
  for(const ent of fs.readdirSync(dir, { withFileTypes: true })){
    if(ent.name.startsWith('_') || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if(ent.isDirectory()){
      if(skipDirs.has(ent.name)) continue;
      walk(full, relBase ? relBase + '/' + ent.name : ent.name);
    } else if(ent.isFile()){
      if(skip.has(ent.name)) continue;
      const st = fs.statSync(full);
      out.push({ n: ent.name, d: relBase || '', s: st.size, t: toDate(st.mtime) });
    }
  }
}
walk(root, '');
out.sort((a, b) => {
  if((a.d === '') !== (b.d === '')) return a.d === '' ? -1 : 1;
  if(a.d !== b.d) return a.d.localeCompare(b.d, 'zh');
  return a.n.localeCompare(b.n, 'zh');
});

const html = fs.readFileSync(htmlFile, 'utf8');
const s = html.indexOf('const FILES = [');
if(s < 0){ console.error('ERROR: FILES array not found in index.html'); process.exit(1); }
const e = html.indexOf('\n];', s) + 3;
const lines = out.map(f =>
  '  {n:' + JSON.stringify(f.n) + ', d:' + JSON.stringify(f.d) + ', s:' + f.s + ', t:' + JSON.stringify(f.t) + '},'
).join('\n');
fs.writeFileSync(htmlFile, html.slice(0, s) + 'const FILES = [\n' + lines + '\n];' + html.slice(e), 'utf8');

const total = out.reduce((s, f) => s + f.s, 0);
console.log('Scanned files: ' + out.length);
console.log('Total size: ' + (total / mb).toFixed(1) + ' MB');
console.log('index.html updated. Now deploy this folder to your cloud hosting.');
