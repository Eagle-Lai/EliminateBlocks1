const fs = require('fs');
const path = require('path');
const PROJ = Editor.Project.path;
const buildCode = fs.readFileSync(path.join(PROJ, 'scripts/prefabs/build.js'), 'utf8');
const frames = JSON.parse(fs.readFileSync(path.join(PROJ, 'scripts/prefabs/frames.json'), 'utf8'));
const res = await Editor.Message.request('scene', 'execute-scene-script', {
  name: 'ccreator-mcp',
  method: 'evalScript',
  args: { code: buildCode, batch: { start: 33, count: 2 }, frames, fontUuid: 'ececa094-2038-405c-ba60-fed397822d6f', anims: {} },
});
const item = res && res.items && res.items[0];
return { keys: res ? Object.keys(res) : null, from: res && res.from, to: res && res.to, itemType: item ? typeof item.json : 'none', head: item && typeof item.json === 'string' ? item.json.slice(0, 80) : null };
