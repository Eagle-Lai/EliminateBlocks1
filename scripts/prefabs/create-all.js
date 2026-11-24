const fs = require('fs');
const path = require('path');
const built = JSON.parse(fs.readFileSync(path.join(Editor.Project.path, 'scripts/prefabs/built.json'), 'utf8'));
const out = [];
for (const item of built.built) {
  const url = `db://assets/resources/prefabs/${item.rel}.prefab`;
  try {
    await Editor.Message.request('scene', 'create-prefab', item.uuid, url);
    out.push(item.rel);
  } catch (e) { out.push(item.rel + ' ERR ' + String(e && e.message ? e.message : e)); }
}
return out;
