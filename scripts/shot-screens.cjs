#!/usr/bin/env node
/**
 * 关键屏幕 × 3 分辨率截图（§16.1）。
 * 通过页面内 UIManager 直接开屏，保证可重复；前置：静态服务器指向 build/web-mobile。
 * 用法：node scripts/shot-screens.cjs [url]
 */
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = process.env.SHOT_OUT ? path.resolve(process.env.SHOT_OUT) : path.resolve(__dirname, '../docs/screenshots');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VIEWPORTS = [
    { name: '750x1334', w: 750, h: 1334 },
    { name: '375x667', w: 375, h: 667 },
    { name: '1280x720', w: 1280, h: 720 },
];

const OPEN = {
    home: "cc.js.getClassByName('UIManager').instance.open('home', { coins: 120, best: 3600 })",
    chapter: "cc.js.getClassByName('UIManager').instance.open('chapterMap', { stars: {}, chapter: 1 })",
    daily: "cc.js.getClassByName('UIManager').instance.open('dailyPanel', { done: [3, 10], streak: 2 })",
    settings: "cc.js.getClassByName('UIManager').instance.open('settings', { muted: false })",
    dialog: "(async () => { const v = await cc.js.getClassByName('UIManager').instance.open('dialog'); v.show({ tag: '关卡结算', title: '完美通关', score: '3600', subtitle: '等级 3 · 消除 4 行 · 步数 21', stars: 3, buttons: [{ text: '下一关', kind: 'primary', onClick: () => {} }, { text: '返回首页', kind: 'secondary', onClick: () => {} }] }); })()",
    talent: "(async () => { const v = await cc.js.getClassByName('UIManager').instance.open('talentPicker'); const offers = [{ id: 1, name: '甜度加成', desc: '所有得分 +8%', rarity: 'common', category: 'score', icon: 'talent_score', mods: {} }, { id: 13, name: '连锁大师', desc: '连锁倍率 +0.25', rarity: 'rare', category: 'score', icon: 'talent_chain', mods: {} }, { id: 25, name: '糖爆共振', desc: '糖爆分数 ×1.5', rarity: 'legendary', category: 'sugar', icon: 'talent_special', mods: {} }]; v.play(offers); })()",
    mutationIntro: "(async () => { const v = await cc.js.getClassByName('UIManager').instance.open('mutationIntro'); v.play(1, 'standard'); })()",
    colorPicker: "cc.js.getClassByName('UIManager').instance.open('colorPicker')",
    replay: "cc.js.getClassByName('UIManager').instance.open('replay', { title: '最佳局 3600' })",
};

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--enable-unsafe-swiftshader', '--no-sandbox', '--disable-dev-shm-usage'],
    });
    let errors = 0;
    for (const vp of VIEWPORTS) {
        const page = await browser.newPage();
        page.on('pageerror', (e) => { errors++; console.log('[' + vp.name + '] pageerror', e.message.slice(0, 160)); });
        await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(6500);

        for (const [name, code] of Object.entries(OPEN)) {
            try {
                await page.evaluate("cc.js.getClassByName('UIManager').instance.closeAll()");
                await sleep(150);
                await page.evaluate('(async () => { ' + code + ' })()');
                await sleep(name === 'mutationIntro' ? 600 : 1400);
                await page.screenshot({ path: path.join(OUT, vp.name + '-' + name + '.png') });
            } catch (err) {
                errors++;
                console.log('[' + vp.name + '] ' + name + ' 失败：', String(err).slice(0, 160));
            }
        }
        await page.evaluate("cc.js.getClassByName('UIManager').instance.closeAll()");
        await page.close();
    }
    await browser.close();
    console.log('[shot:screens] 完成，输出 ' + OUT + '，页面错误 ' + errors);
    if (errors > 0) process.exit(1);
})();
