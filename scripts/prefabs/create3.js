const fs = require('fs');
const path = require('path');
const built = JSON.parse(fs.readFileSync(path.join(Editor.Project.path, 'scripts/prefabs/built.json'), 'utf8'));
const want = ['game/PieceCell', 'ui/LevelNode', 'ui/ChapterTab'];
const out = [];
for (const item of built.built) {
  if (!want.includes(item.rel)) continue;
  const url = `db://assets/resources/prefabs/${item.rel}.prefab`;
  try {
    await Editor.Message.request('scene', 'create-prefab', item.uuid, url);
    out.push({ rel: item.rel, ok: true });
  } catch (e) {
    out.push({ rel: item.rel, error: String(e && e.message ? e.message : e) });
  }
}
return out;
