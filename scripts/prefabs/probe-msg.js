const fs = require('fs');
const path = require('path');
const PROJ = Editor.Project.path;
const buildCode = fs.readFileSync(path.join(PROJ, 'scripts/prefabs/build.js'), 'utf8');
const frames = JSON.parse(fs.readFileSync(path.join(PROJ, 'scripts/prefabs/frames.json'), 'utf8'));
const res = await Editor.Message.request('scene', 'execute-scene-script', {
  name: 'ccreator-mcp',
  method: 'evalScript',
  args: [[{ code: buildCode, args: { batch: { start: 24, count: 1 }, frames, fontUuid: 'ececa094-2038-405c-ba60-fed397822d6f', anims: {} } }]],
});
const item = res.items[0];
const arr = typeof item.json === 'string' ? JSON.parse(item.json) : item.json;
const root = [o => o][0] && arr.filter(o => o.__type__ === 'cc.Node' && o._parent === null)[0];
const comps = root ? root._components.map(c => arr[c.__id__].__type__) : null;
return { from: res.from, keys: Object.keys(res), comps, head: arr.length };
