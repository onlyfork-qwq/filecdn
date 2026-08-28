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

function walk(dir, relBase, out, skipDirs, skipFiles){
  for(const ent of fs.readdirSync(dir, { withFileTypes: true })){
    if(ent.name.startsWith('.') || skipDirs.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if(ent.isDirectory()){
      walk(full, relBase ? relBase + '/' + ent.name : ent.name, out, skipDirs, skipFiles);
    } else if(ent.isFile()){
      if(skipFiles.has(ent.name)) continue;
      const st = fs.statSync(full);
      out.push({ n: ent.name, d: relBase || '', s: st.size, t: toDate(st.mtime) });
    }
  }
}

module.exports = (req, res) => {
  const withImg = new URL(req.url, 'http://x').searchParams.get('all') === '1';
  const out = [];
  const skipDirs = new Set(['.git', 'node_modules', 'api', '.vercel']);
  if(!withImg) skipDirs.add('img'); // 默认排除 img（图床），?all=1 时保留
  const skipFiles = new Set([
    'index.html', 'generate-index.js', 'server.js', 'api/files.js',
    '启动索引服务.cmd', '生成索引.cmd',
    'package.json', 'package-lock.json', 'pnpm-lock.yaml',
    'vercel.json', 'README.md', 'LICENSE',
  ]);
  walk(process.cwd(), '', out, skipDirs, skipFiles);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*'); // 允许博客跨域读取
  res.status(200).send(JSON.stringify(out));
};

