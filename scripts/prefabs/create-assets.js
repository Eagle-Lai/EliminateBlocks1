// 在主进程执行：把场景里的临时节点树逐个转成 .prefab 资产，然后删除临时根。
const fs = require('fs');
const path = require('path');
const built = JSON.parse(fs.readFileSync(path.join(Editor.Project.path, 'scripts/prefabs/built.json'), 'utf8'));

for (const dir of ['ui', 'game', 'fx']) {
  await Editor.Message.request('asset-db', 'create-asset', `db://assets/resources/prefabs/${dir}`, null);
}

const created = [];
const failed = [];
for (const item of built.built) {
  const url = `db://assets/resources/prefabs/${item.rel}.prefab`;
  try {
    const exists = await Editor.Message.request('asset-db', 'query-asset-info', url);
    if (exists) {
      failed.push({ rel: item.rel, error: 'exists' });
      continue;
    }
    await Editor.Message.request('scene', 'create-prefab', item.uuid, url);
    const info = await Editor.Message.request('asset-db', 'query-asset-info', url);
    created.push({ rel: item.rel, uuid: info && info.uuid });
  } catch (e) {
    failed.push({ rel: item.rel, error: String(e && e.message ? e.message : e) });
  }
}

await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/resources/prefabs');
return { created: created.length, failed, list: created };
