#!/usr/bin/env node
/** 包体门：主包 ≤3.9MB，总分包 ≤10.5MB。 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build/web-mobile');
const MAIN_LIMIT = 3.9 * 1024 * 1024;
const TOTAL_LIMIT = 10.5 * 1024 * 1024;

if (!fs.existsSync(BUILD)) {
    console.error('[verify-package] 缺少 build/web-mobile，请先构建');
    process.exit(1);
}
const size = (p) => {
    if (!fs.existsSync(p)) return 0;
    const st = fs.statSync(p);
    if (st.isFile()) return st.size;
    return fs.readdirSync(p).reduce((s, n) => s + size(path.join(p, n)), 0);
};
const assets = path.join(BUILD, 'assets');
// 主包口径：游戏脚本 + 主包资源（cocos-js 是引擎运行时，单列不计入主包，但计入总包）
const gameMain = size(path.join(assets, 'main')) + size(path.join(assets, 'resources')) + size(path.join(assets, 'internal')) + size(path.join(BUILD, 'src'));
const engine = size(path.join(BUILD, 'cocos-js')) + size(path.join(BUILD, 'index.js')) + size(path.join(BUILD, 'application.js')) + size(path.join(BUILD, 'style.css'));
let bundles = 0;
const bundleList = [];
if (fs.existsSync(assets)) {
    for (const name of fs.readdirSync(assets)) {
        if (['main', 'resources', 'internal'].includes(name)) continue;
        const s = size(path.join(assets, name));
        bundles += s;
        bundleList.push([name, s]);
    }
}
const mainTotal = gameMain;
const total = mainTotal + engine + bundles;
const mb = (n) => (n / 1024 / 1024).toFixed(2) + 'MB';

console.log(`[verify-package] 主包 ${mb(mainTotal)}（脚本+主包资源）`);
console.log(`[verify-package] 引擎 ${mb(engine)}（cocos-js，计入总包）`);
for (const [name, s] of bundleList.sort((a, b) => b[1] - a[1])) console.log(`  - 分包 ${name}: ${mb(s)}`);
console.log(`[verify-package] 总包 ${mb(total)}`);

const errors = [];
if (mainTotal > MAIN_LIMIT) errors.push(`主包 ${mb(mainTotal)} > 3.9MB`);
if (total > TOTAL_LIMIT) errors.push(`总包 ${mb(total)} > 10.5MB`);
if (errors.length) {
    console.error('[verify-package] 失败：', errors.join('；'));
    process.exit(1);
}
console.log('[verify-package] OK');
