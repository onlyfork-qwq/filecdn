/* Vercel Serverless 函数：扫描部署目录并返回文件列表
   路径：/api/files  ->  GET 返回 JSON 数组 [{n,d,s,t}, ...]
   默认排除 img/（图床图片）与辅助文件，供博客 /gui 使用；
   加 ?all=1 时包含 img/（GUI 自带的文件列表用）。 */
const fs = require('fs');
const path = require('path');

function toDate(d){
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function walk(dir, relBase, out, skipDirs, skipFiles, meta){
  for(const ent of fs.readdirSync(dir, { withFileTypes: true })){
    if(ent.name.startsWith('.') || skipDirs.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if(ent.isDirectory()){
      walk(full, relBase ? relBase + '/' + ent.name : ent.name, out, skipDirs, skipFiles, meta);
    } else if(ent.isFile()){
      if(skipFiles.has(ent.name)) continue;
      const st = fs.statSync(full);
      const rel = relBase ? relBase + '/' + ent.name : ent.name;
      const t = (meta && meta[rel]) || toDate(st.mtime); // 优先用 git 提交日期
      out.push({ n: ent.name, d: relBase || '', s: st.size, t });
    }
  }
}

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtSize(b){
  if(b >= 1e9) return (b/1e9).toFixed(1) + " GB";
  if(b >= 1e6) return (b/1e6).toFixed(1) + " MB";
  if(b >= 1e3) return Math.round(b/1e3) + " KB";
  return b + " B";
}
/* 渲染成 HTML：每个文件变成可点击链接（浏览器直接访问用） */
function renderHtml(files){
  const groups = new Map();
  files.forEach(f => {
    const k = f.d === '' ? '根目录' : f.d;
    if(!groups.has(k)) groups.set(k, []);
    groups.get(k).push(f);
  });
  const rows = [...groups.entries()].map(([folder, list]) => {
    const lis = list.map(f => {
      const href = '/' + ((f.d ? f.d + '/' : '') + f.n).split('/').map(encodeURIComponent).join('/');
      return '<li><a href="' + href + '" target="_blank" rel="noopener">' + esc(f.n) + '</a><span class="meta">' + fmtSize(f.s) + ' · ' + f.t + '</span></li>';
    }).join('');
    return '<div class="group"><h2>' + esc(folder) + '</h2><ul>' + lis + '</ul></div>';
  }).join('');
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>文件列表</title>' +
    '<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:0 auto;padding:24px;background:#f6f7f9;color:#1f2328}'
    + 'h1{font-size:24px;margin:0 0 4px}.sub{color:#6b7280;margin:0 0 24px;font-size:14px}'
    + '.group{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:16px}'
    + '.group h2{font-size:16px;margin:0 0 10px;display:flex;align-items:center;gap:8px}'
    + '.group h2::before{content:"";width:10px;height:10px;border-radius:3px;background:#2563eb;display:inline-block}'
    + 'ul{list-style:none;margin:0;padding:0}.group li{display:flex;justify-content:space-between;align-items:center;padding:8px 4px;border-bottom:1px solid #f1f2f4}'
    + '.group li:last-child{border-bottom:none}'
    + 'a{color:#2563eb;text-decoration:none;word-break:break-all}a:hover{text-decoration:underline}'
    + '.meta{color:#9ca3af;font-size:13px;white-space:nowrap;margin-left:16px}</style></head><body>'
    + '<h1>文件列表</h1><p class="sub">共 ' + files.length + ' 个文件 · 点击文件名下载</p>' + rows + '</body></html>';
}

module.exports = (req, res) => {
  const u = new URL(req.url, 'http://x');
  const withImg = u.searchParams.get('all') === '1';
  const asHtml = u.searchParams.get('html') === '1';
  const out = [];
  const skipDirs = new Set(['.git', 'node_modules', 'api', '.vercel', '___vc']);
  if(!withImg) skipDirs.add('img'); // 默认排除 img（图床），?all=1 时保留
  const skipFiles = new Set([
    'index.html', 'generate-index.js', 'server.js', 'api/files.js',
    '启动索引服务.cmd', '生成索引.cmd',
    'package.json', 'package-lock.json', 'pnpm-lock.yaml',
    'vercel.json', 'README.md', 'LICENSE', '__env.encrypted', 'files-meta.json',
  ]);
  /* 读取构建期生成的 git 提交日期元数据，覆盖系统盖的统一时间戳 */
  let meta = null;
  try{
    const mp = path.join(process.cwd(), 'files-meta.json');
    if(fs.existsSync(mp)) meta = JSON.parse(fs.readFileSync(mp, 'utf8'));
  }catch(e){ meta = null; }
  walk(process.cwd(), '', out, skipDirs, skipFiles, meta);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*'); // 允许博客跨域读取
  if(asHtml){
    // 浏览器直接访问：渲染成带链接的网页
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderHtml(out));
    return;
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).send(JSON.stringify(out));
};

