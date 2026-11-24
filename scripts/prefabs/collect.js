const fs = require('fs');
const path = require('path');
const root = path.join(Editor.Project.path, 'assets', 'resources', 'art');
const out = {};
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    if (!/\.(png|jpg|jpeg)$/i.test(name)) continue;
    const rel = path.relative(path.join(Editor.Project.path, 'assets', 'resources'), full).replace(/\\/g, '/');
    const key = rel.replace(/\.(png|jpg|jpeg)$/i, '');
    out[key] = 'db://assets/resources/' + rel + '/spriteFrame';
  }
}
walk(root);
const map = {};
for (const [key, url] of Object.entries(out)) {
  const uuid = await Editor.Message.request('asset-db', 'query-uuid', url);
  if (uuid) map[key] = uuid;
}
return { count: Object.keys(map).length, map };
