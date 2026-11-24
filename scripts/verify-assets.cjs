#!/usr/bin/env node
/** 资源门：100 图 / 4 图集配置 / 56 SFX / 8 BGM / 1 字体 / 38 Prefab / 引用 0 缺失。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };
const walk = (dir, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
};

// 1) 图片 100 张
const artRoot = path.join(ROOT, 'assets/resources/art');
const images = [
    ...walk(artRoot),
    ...walk(path.join(ROOT, 'assets/bundles')),
].filter((f) => /\.(png|jpg)$/i.test(f) && !f.includes('prefabs'));
ok(images.length === 100, `图片数 ${images.length} ≠ 100`);
for (const f of images) ok(fs.statSync(f).size > 0, `0 字节图片：${f}`);

// 2) 音频：56 SFX + 8 BGM
const sfxFiles = walk(path.join(ROOT, 'assets/bundles/audio-sfx')).filter((f) => f.endsWith('.wav'));
const bgmFiles = [
    ...walk(path.join(ROOT, 'assets/bundles/audio-bgm')),
    ...walk(path.join(ROOT, 'assets/bundles/ch1')),
    ...walk(path.join(ROOT, 'assets/bundles/ch2')),
    ...walk(path.join(ROOT, 'assets/bundles/ch3')),
    ...walk(path.join(ROOT, 'assets/bundles/ch4')),
    ...walk(path.join(ROOT, 'assets/bundles/ch5')),
    ...walk(path.join(ROOT, 'assets/bundles/ch6')),
].filter((f) => f.endsWith('.mp3'));
ok(sfxFiles.length === 56, `SFX ${sfxFiles.length} ≠ 56`);
ok(bgmFiles.length === 8, `BGM ${bgmFiles.length} ≠ 8`);

// 3) 字体
const font = path.join(ROOT, 'assets/resources/font/game_sc.ttf');
ok(fs.existsSync(font) && fs.statSync(font).size > 0, '缺少字体 game_sc.ttf');

// 4) 38 个 Prefab
const prefabs = walk(path.join(ROOT, 'assets/resources/prefabs')).filter((f) => f.endsWith('.prefab'));
ok(prefabs.length === 38, `Prefab ${prefabs.length} ≠ 38`);

// 5) 图集配置 4 张
const atlas = walk(path.join(ROOT, 'assets/resources/art')).filter((f) => f.endsWith('.pac'));
ok(atlas.length === 4, `图集 ${atlas.length} ≠ 4`);

// 6) Prefab 引用的 uuid 都存在
const metaUuids = new Set();
for (const m of walk(path.join(ROOT, 'assets'))) {
    if (!m.endsWith('.meta')) continue;
    try {
        const data = JSON.parse(fs.readFileSync(m, 'utf8'));
        if (data.uuid) metaUuids.add(data.uuid);
        if (data.subMetas) for (const k of Object.keys(data.subMetas)) {
            const sub = data.subMetas[k];
            if (sub && sub.uuid) metaUuids.add(sub.uuid);
        }
    } catch {
        /* 忽略损坏 meta */
    }
}
let refCount = 0;
for (const prefab of prefabs) {
    const text = fs.readFileSync(prefab, 'utf8');
    const matches = text.match(/"__uuid__":\s*"([0-9a-fA-F-]{36})/g) || [];
    for (const m of matches) {
        refCount++;
        const uuid = m.match(/"([0-9a-fA-F-]{36})/)[1];
        ok(metaUuids.has(uuid), `Prefab ${path.basename(prefab)} 引用缺失 uuid ${uuid}`);
    }
}

// 7) 音频 key 全部有文件
const keysText = fs.readFileSync(path.join(ROOT, 'assets/scripts/config/AssetKeys.ts'), 'utf8');
const sfxKeys = [...keysText.matchAll(/'(audio\/sfx\/[a-z0-9_]+)'/g)].map((m) => m[1]);
for (const key of sfxKeys) {
    const name = path.basename(key) + '.wav';
    ok(sfxFiles.some((f) => f.endsWith(name)), `缺音效文件：${name}`);
}
const bgmKeys = ['home', 'result', 'ch1_musicbox', 'ch2_bells', 'ch3_waltz', 'ch4_pads', 'ch5_synth', 'ch6_ensemble'];
for (const key of bgmKeys) ok(bgmFiles.some((f) => f.endsWith(key + '.mp3')), `缺 BGM：${key}`);

if (errors.length > 0) {
    console.error('[verify-assets] 失败：');
    for (const e of errors.slice(0, 40)) console.error(' -', e);
    process.exit(1);
}
console.log(`[verify-assets] OK：100 图 / 56 SFX / 8 BGM / 1 字体 / 38 Prefab / 引用 ${refCount} 个全部命中`);
