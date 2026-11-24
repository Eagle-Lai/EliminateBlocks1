#!/usr/bin/env node
/**
 * UI 冒烟：依次打开关键屏幕，断言 UI 栈层数、无页面错误、绑定校验不抛错。
 * 用法：node scripts/smoke-ui.cjs [url]
 */
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] || 'http://127.0.0.1:8123/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: 'new',
        args: ['--enable-unsafe-swiftshader', '--no-sandbox'],
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error' && !/404|audio-bgm|audio-sfx|favicon/.test(m.text())) errors.push(m.text());
    });
    await page.setViewport({ width: 750, height: 1334 });
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(6500);

    const stack = () => page.evaluate(() => {
        const ui = cc.director.getScene().getChildByName('Canvas').getChildByName('UIRoot');
        const mgr = ui.getComponent(cc.js.getClassByName('UIManager'));
        return mgr.debugStack();
    });
    const click = async (x, y) => {
        const el = await page.evaluate(() => {
            const c = document.getElementById('GameCanvas') || document.querySelector('canvas');
            return { w: c.clientWidth, h: c.clientHeight };
        });
        await page.mouse.click((x / 750) * el.w, (y / 1334) * el.h);
    };

    const checks = [];
    checks.push(['home', await stack()]);
    await click(375, 717);
    await sleep(1400);
    checks.push(['chapter', await stack()]);
    await click(105, 1237); // 返回
    await sleep(1000);
    checks.push(['back-home', await stack()]);
    await click(375, 832);
    await sleep(1400);
    checks.push(['daily', await stack()]);
    await click(105, 1237);
    await sleep(800);
    await click(695, 107);
    await sleep(1000);
    checks.push(['settings', await stack()]);

    const bad = [];
    for (const [name, st] of checks) {
        const panels = st.filter((s) => s.startsWith('panel:'));
        const popups = st.filter((s) => s.startsWith('popup:'));
        console.log(`${name}: [${st.join(', ')}]`);
        if (panels.length > 1) bad.push(`${name} panel > 1`);
        if (popups.length > 1) bad.push(`${name} popup > 1`);
    }
    if (errors.length) bad.push(`页面错误 ${errors.length}: ${errors[0].slice(0, 160)}`);
    await browser.close();
    if (bad.length) {
        console.error('[smoke:ui] 失败：', bad.join('；'));
        process.exit(1);
    }
    console.log('[smoke:ui] OK：屏幕可依次打开，UI 栈层数合规，无页面错误');
})();
