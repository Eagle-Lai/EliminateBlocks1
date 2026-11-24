#!/usr/bin/env node
/** Prefab 门：38 个、根组件正确、命名稳定、节点数预算、引用完整。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };

const registry = fs.readFileSync(path.join(ROOT, 'assets/scripts/config/UIPrefabs.ts'), 'utf8');
const paths = registry.split("path: '").slice(1).map((part) => part.split("'")[0]);
ok(paths.length === 38, `注册表 ${paths.length} ≠ 38`);

for (const rel of paths) {
    const file = path.join(ROOT, 'assets/resources', rel + '.prefab');
    ok(fs.existsSync(file), `缺少 Prefab：${rel}`);
    if (!fs.existsSync(file)) continue;
    let data;
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch { errors.push(`JSON 解析失败：${rel}`); continue; }

    const prefabAsset = data.find((o) => o.__type__ === 'cc.Prefab');
    const root = data[(prefabAsset.data || prefabAsset.scene).__id__];
    ok(root && root.__type__ === 'cc.Node', `${rel} 根节点异常`);
    ok(root._name === path.basename(rel), `${rel} 根节点名 ${root._name} ≠ ${path.basename(rel)}`);

    const comps = (root._components || []).map((c) => data[c.__id__].__type__);
    ok(comps.includes('cc.UITransform'), `${rel} 根节点缺 UITransform`);
    const custom = comps.filter((t) => !String(t).startsWith('cc.'));
    ok(custom.length >= 1, `${rel} 根节点缺视图组件`);

    const nodes = data.filter((o) => o.__type__ === 'cc.Node').length;
    ok(nodes <= 550, `${rel} 节点数 ${nodes} > 550`);
    // 每个节点必须有 UITransform（UI Prefab 约定）
    const missing = data.filter((o) => o.__type__ === 'cc.Node' && !(o._components || []).some((c) => data[c.__id__].__type__ === 'cc.UITransform'));
    ok(missing.length === 0, `${rel} 有 ${missing.length} 个节点缺 UITransform`);
}

if (errors.length > 0) {
    console.error('[verify-prefabs] 失败：');
    for (const e of errors.slice(0, 40)) console.error(' -', e);
    process.exit(1);
}
console.log('[verify-prefabs] OK：38 个 Prefab，根组件与命名全部合规');
