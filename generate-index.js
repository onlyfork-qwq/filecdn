/* File Index Generator
   生成器：扫描当前目录，把真实文件列表写回 index.html 的 FILES 数组。
   用法：双击「生成索引.cmd」，或命令行运行 node generate-index.js
   流程：放好文件 -> 运行本生成器 -> 部署整个文件夹到云端静态托管。 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = __dirname;
const htmlFile = path.join(root, 'index.html');
const mb = 1048576;

function toDate(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

const out = [];
/* 排除索引自身、本地辅助文件与隐藏文件（.vercel、.git 等）
   GUI 列表需要显示 img/（图床图片），故生成器不排除 img；
   排除 img 仅发生在 API（api/files.js、server.js 的 /api/files）返回给博客 /gui 时。 */
const skip = new Set(['index.html', 'server.js', 'generate-index.js', '启动索引服务.cmd', '生成索引.cmd', 'vercel.json']);
const skipDirs = new Set(['.git', 'node_modules', 'api', '___vc']);
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

/* 用 git 提交时间生成 files-meta.json（构建环境有 .git 时可用），
   供 API 显示真实日期，避免 Vercel 打包盖的统一时间戳(如 2018-10-20)。 */
function gitDate(rel){
  try{
    const out = execFileSync('git', ['log','-1','--format=%ci','--', rel], { encoding:'utf8', cwd: root }).trim();
    const m = out.match(/^\d{4}-\d{2}-\d{2}/);
    if(m) return m[0];
  }catch(e){}
  return null;
}
const meta = {};
out.forEach(f => {
  const rel = f.d ? f.d + '/' + f.n : f.n;
  const gd = gitDate(rel);
  if(gd) meta[rel] = gd;
});
if(Object.keys(meta).length){
  fs.writeFileSync(path.join(root, 'files-meta.json'), JSON.stringify(meta), 'utf8');
  console.log('files-meta.json written: ' + Object.keys(meta).length + ' entries (git commit dates)');
}

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
