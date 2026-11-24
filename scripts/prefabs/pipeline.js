// 主进程编排：分批调用场景脚本构建节点树 → EditorExtends.serialize → 直接写 .prefab + .meta。
// 全程不走 scene:create-prefab（避免原生保存对话框）、每批控制在秒级（避免 Scene Not Response 看门狗）。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROJ = Editor.Project.path;
const buildCode = fs.readFileSync(path.join(PROJ, 'scripts/prefabs/build.js'), 'utf8');
const frames = JSON.parse(fs.readFileSync(path.join(PROJ, 'scripts/prefabs/frames.json'), 'utf8'));
const fontUuid = 'ececa094-2038-405c-ba60-fed397822d6f';
const anims = {
  'dialog-in': 'a1b2c3d4-0000-4000-8000-00000000d101',
  'banner-in': 'a1b2c3d4-0000-4000-8000-00000000d102',
  'toast-in': 'a1b2c3d4-0000-4000-8000-00000000d103',
  'card-in': 'a1b2c3d4-0000-4000-8000-00000000d104',
  burst: 'a1b2c3d4-0000-4000-8000-00000000d105',
  'star-pop': 'a1b2c3d4-0000-4000-8000-00000000d106',
};

const BATCH = 5;
const TOTAL = 38;
const written = [];
const errors = [];
const audit = [];

for (let start = 0; start < TOTAL; start += BATCH) {
  const res = await Editor.Message.request('scene', 'execute-scene-script', {
    name: 'ccreator-mcp',
    method: 'evalScript',
    // Creator 会把 args 展开进方法调用：args=[[payload]] → evalScript([payload]) → const [options] = args
    args: [[{ code: buildCode, args: { batch: { start, count: BATCH }, frames, fontUuid, anims } }]],
  });
  const items = (res && res.items) || [];
  for (const item of items) {
    const parsed = typeof item.json === 'string' ? JSON.parse(item.json) : item.json;
    const rootNode = parsed.filter(o => o.__type__ === 'cc.Node' && o._parent === null)[0];
    const comps = rootNode ? rootNode._components.map(c => parsed[c.__id__].__type__) : [];
    const custom = comps.filter(t => !String(t).startsWith('cc.'));
    if (custom.length === 0) errors.push(`batch ${start}: ${item.rel} 无自定义组件`);

    const disk = path.join(PROJ, 'assets/resources/prefabs', item.rel + '.prefab');
    fs.mkdirSync(path.dirname(disk), { recursive: true });
    const arr = typeof item.json === 'string' ? JSON.parse(item.json) : item.json;
    // 关键：序列化数组前插入了 cc.Prefab 包装头，所有 __id__ 引用必须整体 +1，
    // 否则整个预制体引用错位（组件全部"消失"、运行时反序列化失败）。
    const bump = (node) => {
      if (Array.isArray(node)) { node.forEach(bump); return node; }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === '__id__' && typeof v === 'number') node[k] = v + 1;
          else bump(v);
        }
      }
      return node;
    };
    bump(arr);
    const wrapper = {
      __type__: 'cc.Prefab',
      _name: item.name,
      _objFlags: 0,
      __editorExtras__: {},
      _native: '',
      data: { __id__: 1 },
      optimizationPolicy: 0,
      persistent: false,
    };
    fs.writeFileSync(disk, JSON.stringify([wrapper, ...arr], null, 2));
    const meta = {
      ver: '1.1.50',
      importer: 'prefab',
      imported: true,
      uuid: crypto.randomUUID(),
      files: ['.json'],
      subMetas: {},
      userData: { syncNodeName: item.name },
    };
    fs.writeFileSync(disk + '.meta', JSON.stringify(meta, null, 2));
    written.push(item.rel);
  }
}
return { written: written.length, list: written, errors };

await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets/resources/prefabs');
return { written: written.length, list: written, errors };
