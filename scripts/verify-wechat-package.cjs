#!/usr/bin/env node
/** 微信发布目录校验。按 game.json 中的实际分包根目录拆分字节数。 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(process.argv[2] || path.join(__dirname, '../build/wechatgame'));
const expected = ['resources', 'audio-bgm', 'audio-sfx', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'daily'];
const mib = 1024 * 1024;
const format = bytes => (bytes / mib).toFixed(3) + ' MiB';
const errors = [];

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function bytes(dir) {
    let total = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) total += bytes(file);
        else if (entry.isFile()) total += fs.statSync(file).size;
    }
    return total;
}

function check() {
    const manifest = readJson(path.join(root, 'game.json'));
    const list = manifest.subpackages ?? manifest.subPackages ?? [];
    assert.ok(Array.isArray(list), 'game.json 分包清单不是数组');
    const src = path.join(root, 'src');
    const settingsName = fs.readdirSync(src).find(name => /^settings(?:\.[a-z\d_-]+)?\.json$/i.test(name));
    assert.ok(settingsName, '缺少 Cocos src/settings.json');
    const settings = readJson(path.join(src, settingsName)).assets;
    const runtime = new Set(settings.subpackages);
    const roots = [];
    const names = new Set();
    let subBytes = 0;

    for (const pkg of list) {
        assert.ok(pkg && typeof pkg.name === 'string' && typeof pkg.root === 'string', '游戏分包条目缺少 name 或 root');
        const dir = path.resolve(root, pkg.root);
        assert.ok(dir.startsWith(root + path.sep), '非法分包路径 ' + pkg.root);
        assert.ok(!roots.some(other => dir === other || dir.startsWith(other + path.sep) || other.startsWith(dir + path.sep)), '分包路径有重叠 ' + pkg.root);
        assert.ok(!names.has(pkg.name), '重复分包名称 ' + pkg.name);
        names.add(pkg.name);
        roots.push(dir);
        assert.ok(fs.statSync(path.join(dir, 'game.js')).size > 0, '分包入口为空 ' + pkg.name);
        if (expected.includes(pkg.name)) {
            assert.equal(dir, path.join(root, 'subpackages', pkg.name), '微信适配器的分包查找路径不匹配 ' + pkg.name);
            const version = settings.bundleVers?.[pkg.name];
            const config = path.join(dir, version ? 'config.' + version + '.json' : 'config.json');
            assert.equal(readJson(config).name, pkg.name, 'Cocos 分包配置名称不匹配 ' + pkg.name);
            if (fs.existsSync(path.join(root, 'assets', pkg.name))) errors.push('分包资源也出现在主包 assets/' + pkg.name);
        }
        const count = bytes(dir);
        subBytes += count;
        console.log('  ' + pkg.name + '  ' + format(count));
        if (count > 4 * mib) errors.push('单分包超过 4 MiB ' + pkg.name);
    }
    for (const name of expected) {
        if (!names.has(name)) errors.push('game.json 未声明本地分包 ' + name);
        if (!runtime.has(name)) errors.push('Cocos assets.subpackages 缺少 ' + name);
    }
    if (!settings.preloadBundles?.some(entry => entry.bundle === 'resources')) errors.push('启动预载缺少 resources');
    for (const name of settings.remoteBundles ?? []) {
        if (expected.includes(name)) errors.push('本地分包同时标记为远程 ' + name);
    }
    assert.ok(fs.statSync(path.join(root, 'game.js')).size > 0, '主包入口为空');
    const ignore = readJson(path.join(root, 'project.config.json')).packOptions?.ignore ?? [];
    const localFiles = new Map([['debug.log', 'file'], ['.runtime-bridge', 'folder']]);
    let raw = 0;
    let excluded = 0;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const file = path.join(root, entry.name);
        const size = entry.isDirectory() ? bytes(file) : fs.statSync(file).size;
        raw += size;
        const type = entry.isDirectory() ? 'folder' : 'file';
        if (localFiles.get(entry.name) !== type) continue;
        const skip = ignore.some(rule => rule?.type === type && rule.value === entry.name);
        console.log('本地调试项 ' + entry.name + ' ' + size + ' 字节，' + (skip ? '已按发布配置排除' : '计入主包'));
        if (skip) excluded += size;
        else errors.push('发布配置未排除本地调试项 ' + entry.name);
    }
    const total = raw - excluded;
    const main = total - subBytes;
    console.log('微信主包（含引擎） ' + format(main) + '；分包 ' + format(subBytes) + '；总计 ' + format(total));
    console.log('磁盘总计 ' + raw + ' 字节；发布配置明确排除 ' + excluded + ' 字节');
    if (main > 3.9 * mib) errors.push('主包超过项目 3.9 MiB 门槛');
    if (total > 10.5 * mib) errors.push('总包超过项目 10.5 MiB 门槛');
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('[verify-wechat-package] OK');
}

try {
    check();
} catch (error) {
    console.error('[verify-wechat-package] ' + error.message);
    process.exitCode = 1;
}
