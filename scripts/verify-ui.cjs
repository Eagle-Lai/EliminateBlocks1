#!/usr/bin/env node
/**
 * UI 门：扫描 view/ ui/ controller/，禁止运行时拼 UI。
 * 白名单：scripts/debug/**（调试叠层）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['assets/scripts/view', 'assets/scripts/ui', 'assets/scripts/controller'];
const FORBIDDEN = [
    { re: /\bnew\s+Node\s*\(/g, msg: 'new Node() 拼界面' },
    { re: /addComponent\s*\(\s*(Label|Sprite|Button)\b/g, msg: 'addComponent(Label|Sprite|Button)' },
    { re: /\bGraphics\b/g, msg: '使用 Graphics 绘制界面' },
];

let hits = [];
for (const dir of DIRS) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
        if (!name.endsWith('.ts')) continue;
        const file = path.join(abs, name);
        const text = fs.readFileSync(file, 'utf8');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*(\*|\/\/)/.test(line)) continue;
            for (const rule of FORBIDDEN) {
                rule.re.lastIndex = 0;
                if (rule.re.test(line)) {
                    hits.push(`${path.relative(ROOT, file)}:${i + 1}  ${rule.msg}  → ${line.trim().slice(0, 90)}`);
                }
            }
        }
    }
}

// 预制体的默认文案也会在资源加载或首帧时显示。
const prefabRoot = path.join(ROOT, 'assets/resources/prefabs');
for (const group of fs.readdirSync(prefabRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const folder = path.join(prefabRoot, group.name);
    for (const name of fs.readdirSync(folder).filter(name => name.endsWith('.prefab'))) {
        const components = JSON.parse(fs.readFileSync(path.join(folder, name), 'utf8'));
        for (const label of components.filter(item => item.__type__ === 'cc.Label')) {
            if (/[A-Za-z]/.test(label._string)) hits.push(`${name} 包含英文文案：${label._string}`);
        }
    }
}

if (hits.length > 0) {
    console.error('[verify-ui] 界面校验失败：');
    for (const h of hits) console.error(' -', h);
    process.exit(1);
}
console.log('[verify-ui] OK：view/ ui/ controller/ 0 处运行时拼 UI，预制体无英文文案');
